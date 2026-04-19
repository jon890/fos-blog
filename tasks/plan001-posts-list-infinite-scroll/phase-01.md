# Phase 01 — DB 인덱스 추가 + 마이그레이션 SQL 생성

## 컨텍스트 (자기완결 프롬프트)

`/posts/latest`(최신글 cursor 페이징) + `/posts/popular`(인기글 offset 페이징) 무한 스크롤 페이지를 위해 정렬 안정성과 성능을 위한 인덱스 2개를 추가한다. 이 phase는 **스키마 + 마이그레이션 SQL 생성 + 로컬 apply + 커밋까지**만 수행한다. Repository/API 변경은 phase-02 이후에서 진행.

**이 작업의 WHY**: ADR-002 페이지네이션 전략에 따라
- 최신글: `(updatedAt DESC, id DESC)` composite cursor — 동일 updatedAt 존재 시 누락 방지
- 인기글: `(visitCount DESC, pagePath ASC)` — visitCount 동점 시 offset 페이지 간 순서 결정성

인덱스 없이 운영하면 MySQL이 filesort 수행 + 동점 순서 비결정적 → 무한 스크롤 중복/누락 버그.

## 먼저 읽을 문서

- `docs/data-schema.md` — §2 "추가 인덱스" 섹션
- `docs/adr.md` — ADR-002
- `CLAUDE.md` — "DB 스키마 변경 규칙" (db:push 금지)
- `.claude/skills/_shared/common-critic-patterns.md` — BLG1 (db:push 금지)

## 기존 코드 참조

- `src/infra/db/schema/posts.ts` — 기존 `category_idx`, `slug_idx` 패턴
- `src/infra/db/schema/visitStats.ts` — 기존 `visit_stats_page_path_idx` unique 인덱스 패턴
- `drizzle/` 디렉터리 — 기존 마이그레이션 SQL 파일 작명/포맷 참고

## 작업 목록 (총 4개)

### 1. `src/infra/db/schema/posts.ts` 수정

기존 `index` 배열에 composite descending 인덱스 추가:

```ts
(table) => [
  index("category_idx").on(table.category),
  index("slug_idx").on(table.slug),
  index("posts_updated_at_id_idx").on(table.updatedAt.desc(), table.id.desc()),
],
```

Drizzle MySQL core에서 `.desc()` 체인 지원되는지 버전 확인 (drizzle-orm 0.45.1). 미지원이면 `sql` 템플릿 raw index로 대체 — 이 경우 기존 패턴과 맞춤.

### 2. `src/infra/db/schema/visitStats.ts` 수정

```ts
(table) => [
  uniqueIndex("visit_stats_page_path_idx").on(table.pagePath),
  index("visit_stats_count_path_idx").on(table.visitCount.desc(), table.pagePath),
],
```

### 3. 마이그레이션 SQL 생성

```bash
# cwd: <worktree root>
pnpm db:generate
```

생성된 `drizzle/<timestamp>_*.sql` 파일 내용 검증:
- `CREATE INDEX posts_updated_at_id_idx ON posts (updated_at DESC, id DESC);` 포함
- `CREATE INDEX visit_stats_count_path_idx ON visit_stats (visit_count DESC, page_path ASC);` 포함

필요 시 파일명을 의미 있게 수정 (예: `drizzle/XXXX_posts_popular_indexes.sql`). Drizzle journal(`drizzle/meta/_journal.json`) 정합성 유지.

### 4. 로컬 apply + 변경사항 확인

```bash
# cwd: <worktree root>
pnpm db:migrate
```

적용 성공 후:
```bash
# cwd: <worktree root>
git diff --name-only
# 예상: src/infra/db/schema/posts.ts, src/infra/db/schema/visitStats.ts,
#        drizzle/<new>.sql, drizzle/meta/_journal.json, drizzle/meta/<snapshot>.json
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 스키마 파일에 인덱스 정의 확인
grep -n "posts_updated_at_id_idx" src/infra/db/schema/posts.ts
grep -n "visit_stats_count_path_idx" src/infra/db/schema/visitStats.ts

# 2) 마이그레이션 SQL 파일 존재 + 내용
ls drizzle/*.sql | tail -1 | xargs grep -l "posts_updated_at_id_idx"
ls drizzle/*.sql | tail -1 | xargs grep -l "visit_stats_count_path_idx"

# 3) Drizzle journal 갱신 확인
git diff --name-only | grep -E "drizzle/meta/_journal\.json"

# 4) 타입 체크 통과
pnpm type-check

# 5) db:push 흔적 없음 (BLG1 금지 규칙)
! grep -r "db:push" drizzle/ 2>/dev/null
```

## PHASE_BLOCKED 조건

- `pnpm db:generate`가 빈 diff를 생성 (스키마 수정 미반영) → **PHASE_BLOCKED: drizzle-kit이 desc 인덱스를 감지 못함 — raw SQL 인덱스 방식으로 전환 필요**
- `pnpm db:migrate`가 MySQL 에러로 실패 (로컬 DB 미기동 등) → **PHASE_BLOCKED: 로컬 MySQL 컨테이너 상태 수동 확인 필요 (`pnpm db:up`)**
- Drizzle 버전이 `.desc()` 미지원 → **PHASE_BLOCKED: drizzle-orm 버전업 또는 raw SQL 방식 결정 필요**

## 커밋 제외

이 phase는 **커밋하지 않는다**. team-lead가 모든 phase 검증 후 일괄 커밋. executor는 변경만 수행.
