# Phase 01 — schema + migration + sync 확장

**Model**: sonnet
**Goal**: posts 테이블에 series + seriesOrder 컬럼 추가 + sync 시 frontmatter 추출 → DB 저장.

## Context (자기완결)

`src/infra/db/schema/posts.ts` 의 `posts` 테이블에 series/seriesOrder 컬럼 없음. plan026 (tags) 와 동일 패턴 — frontmatter 추출 → DB 저장.

**플젝 컨벤션 (CLAUDE.md)**:
- DB 변경: `pnpm db:generate` 로 SQL → git 커밋 → `pnpm db:migrate` apply
- `pnpm db:push` production 금지

**결정 (사용자 2026-05-08)**:
- frontmatter `seriesOrder` **필수** — series 있는데 seriesOrder 없으면 sync 로그 경고 + 해당 글의 series 메타 무시 (DB 에는 series=null, seriesOrder=null 저장)

## 작업 항목

### 1. `src/infra/db/schema/posts.ts` 컬럼 추가

`tags` 옆에:

```ts
tags: json("tags").$type<string[]>().notNull().default([]),
series: varchar("series", { length: 255 }),
seriesOrder: int("series_order"),
```

둘 다 nullable — 시리즈 아닌 글이 더 많음. `series_order` snake_case (기존 `series` 와 동일 컨벤션 — `created_at` / `is_active` 처럼).

추가 인덱스 (선택):
```ts
(table) => [
  // ... 기존 인덱스
  index("series_idx").on(table.series),
],
```

같은 series 글 조회가 잦을 것이라 인덱스 가치 있음. 218 글 규모에서는 무시 가능 — 인덱스 안 만들고 시작도 OK.

### 2. drizzle migration 생성

```bash
pnpm db:generate
```

`drizzle/0006_*.sql` 자동 생성. 검토:
- `ALTER TABLE posts ADD COLUMN series VARCHAR(255), ADD COLUMN series_order INT`
- 기존 row 자동 NULL — 파괴적 변경 없음

### 3. SyncService 확장

`src/services/SyncService.ts` 에서 frontmatter 처리 부분에 series / seriesOrder 추출 로직 추가:

```ts
const rawSeries = typeof frontMatter.series === "string" ? frontMatter.series.trim() : "";
const rawOrder = frontMatter.seriesOrder;

let series: string | null = null;
let seriesOrder: number | null = null;

if (rawSeries) {
  const parsedOrder = typeof rawOrder === "number"
    ? rawOrder
    : typeof rawOrder === "string" && rawOrder.trim() !== ""
      ? Number(rawOrder)
      : NaN;

  if (Number.isFinite(parsedOrder) && parsedOrder >= 0) {
    series = rawSeries;
    seriesOrder = Math.trunc(parsedOrder);
  } else {
    log.warn(
      { path, series: rawSeries, rawOrder },
      "frontmatter 'series' 있으나 'seriesOrder' 누락/유효하지 않음 — series 메타 무시"
    );
  }
}

// upsert payload 에 추가
{
  // ... 기존 필드
  series,
  seriesOrder,
}
```

executor 는 SyncService 의 frontmatter 처리 위치를 grep 으로 정확히 찾아 (`grep -n "frontMatter\|tags" src/services/SyncService.ts`) 그 옆에 자연스럽게 추가.

### 4. parseFrontMatter 확장 점검

`src/lib/markdown.ts` 의 `parseFrontMatter` 가 `seriesOrder: 2` 같은 number-looking 값을 string 으로 반환 — SyncService 에서 `Number(rawOrder)` 로 변환. parseFrontMatter 자체 변경 불필요. 단 FrontMatter type 에 `series?: string; seriesOrder?: number | string;` 추가:

```ts
export interface FrontMatter {
  title?: string;
  date?: string;
  description?: string;
  tags?: string[];
  series?: string;
  seriesOrder?: number | string;
  [key: string]: unknown;
}
```

### 5. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# schema
grep -n "series:.*varchar\|seriesOrder:.*int" src/infra/db/schema/posts.ts

# migration
ls drizzle/ | grep -E "0006_.*\.sql"

# sync 확장
grep -n "series\|seriesOrder" src/services/SyncService.ts | head -5
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/infra/db/schema/posts.ts` | 수정 (컬럼 2개) |
| `drizzle/0006_*.sql` | 자동 생성 (커밋 필수) |
| `src/services/SyncService.ts` | 수정 (frontmatter 추출 + upsert) |
| `src/lib/markdown.ts` | 수정 (FrontMatter type 확장) |

## Out of Scope

- Repository / 페이지 / UI → phase 2
- /series 인덱스 페이지 (결정상 OOS)
- 자동 seriesOrder 추정 (sequence number 등) — frontmatter 필수 결정

## Risks

| 리스크 | 완화 |
|---|---|
| 기존 218 글의 series 데이터 부재 | sync 1회 실행으로 frontmatter 가진 글만 자동 채움. 누락 글은 frontmatter 추가 + 다음 sync 에서 자동 반영 |
| seriesOrder 가 string \"2\" 로 들어와 parse 실패 | `Number()` + `Number.isFinite` 체크 — 실패 시 log.warn + null |
| 같은 series 안에서 seriesOrder 중복 (사용자 실수) | DB 제약 없음. 페이지에서 정렬 시 \"동순위\" 발생 — 후속 issue 가능. 1차는 미보호 |
| series 이름 trailing whitespace / 대소문자 | trim 만 적용. 대소문자는 보존 (\"Java GC\" vs \"java gc\" 는 다른 시리즈 — 사용자 책임) |
