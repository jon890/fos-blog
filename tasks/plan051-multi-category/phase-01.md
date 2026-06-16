# Phase 01 — posts.categories 스키마 + 타입 + 마이그레이션(backfill 포함)

**Model**: sonnet
**Status**: pending

---

## 목표

`posts` 테이블에 다중 카테고리 저장용 `categories` JSON 컬럼을 추가한다.
경로 기반 단일 `category`(primary)는 그대로 두고, 다중 소속을 표현할 배열 컬럼을 더한다 (ADR-030).
기존 행이 카테고리 페이지에서 사라지지 않도록 마이그레이션에서 `categories`를 `[category]`로 backfill 한다.

**범위 외**: frontmatter 파싱·sync 로직(phase-02), 조회(phase-03), UI(phase-04). 이 phase 는 스키마/타입/마이그레이션만.

---

## 작업 항목 (3)

### 1. `src/infra/db/schema/posts.ts` — categories 컬럼 추가

`category` 컬럼 정의 아래에 추가한다. `tags` 컬럼과 동일한 패턴(json + notNull + default [])을 따른다.

```ts
categories: json("categories").$type<string[]>().notNull().default([]),
```

위치는 `subcategory` 위(= `category` 바로 다음)에 둔다 — 카테고리 관련 필드를 모은다.

### 2. `src/infra/db/types.ts` — PostData 타입에 categories 추가

`category: string` 을 쓰는 두 타입 정의(현재 7번 줄 부근, 45번 줄 부근) 중 글 메타데이터를 표현하는 `PostData` 에 `categories: string[]` 를 추가한다.
`category`(단일)는 유지한다 — primary 카테고리로 계속 사용한다.

### 3. 마이그레이션 생성 + backfill 추가

```bash
# cwd: <repo root>
pnpm db:generate
```

생성된 `drizzle/` 하위 최신 SQL 파일을 연다. drizzle 이 만든 `ALTER TABLE ... ADD COLUMN categories ...` 문 **뒤에**, 기존 행을 초기화하는 backfill 문을 한 줄 추가한다.

```sql
--> statement-breakpoint
UPDATE `posts` SET `categories` = JSON_ARRAY(`category`) WHERE JSON_LENGTH(`categories`) = 0;
```

이유: `DEFAULT '[]'` 로 추가하면 기존 행 `categories` 가 빈 배열이라, phase-03 의 `JSON_CONTAINS` 조회에서 모든 기존 글이 누락된다. backfill 로 기존 글을 `[category]` 단일 카테고리로 만들어 즉시 정상 동작하게 한다.

> CLAUDE.md "DB 스키마 변경 규칙": `db:generate` 산출물을 커밋한다. 이 backfill 은 데이터 마이그레이션이라 수동 추가가 정당하다(파괴적 변경 아님). 추가 후 SQL 파일을 검토한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/infra/db/schema/posts.ts` | 수정 — categories 컬럼 |
| `src/infra/db/types.ts` | 수정 — PostData.categories |
| `drizzle/*.sql` (신규 생성분) | 신규 — ADD COLUMN + backfill UPDATE |

## 검증

```bash
# cwd: <repo root>
pnpm type-check
grep -n "categories" src/infra/db/schema/posts.ts          # 컬럼 정의 존재
grep -n "categories" src/infra/db/types.ts                 # PostData 타입 존재
grep -rln "JSON_ARRAY(\`category\`)" drizzle/               # backfill 문 존재
```

로컬 적용 확인(MySQL 컨테이너 필요):

```bash
# cwd: <repo root>
pnpm db:migrate:runtime
```

- 적용 후 에러 없이 완료되면 통과. 컨테이너가 없으면 `PHASE_BLOCKED: MySQL 컨테이너 미기동` 출력 후 종료.

## 의도 메모 (왜)

- `category`(단일)를 지우지 않고 유지하는 이유: 정렬·하위호환·primary 표시에 계속 쓰며, frontmatter 없는 기존 글이 그대로 동작한다(ADR-030).
- backfill 을 마이그레이션에 포함하는 이유: 이게 없으면 phase-03 조회에서 기존 글 전체가 사라지는 회귀가 발생한다. phase-02 sync 가 모든 글을 재처리한다는 보장이 없다(sha 변경분만 업데이트).

## Blocked 조건

- MySQL 컨테이너 부재로 `pnpm db:migrate:runtime` 불가 → `PHASE_BLOCKED: MySQL 컨테이너 미기동` 출력 후 종료(스키마/타입/SQL 생성까지는 완료).
