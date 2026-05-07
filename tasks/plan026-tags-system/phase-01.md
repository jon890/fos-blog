# Phase 01 — posts.tags JSON 컬럼 + sync 확장

**Model**: sonnet
**Goal**: posts 테이블에 tags JSON[] 컬럼 추가 + sync 시 frontmatter `tags` 추출해 DB 저장.

## Context (자기완결)

`src/infra/db/schema/posts.ts` 의 `posts` 테이블에 현재 `tags` 컬럼 없음. ArticleFooter 는 frontmatter 에서 runtime 추출 — DB 미저장 상태라 tag 별 글 목록 조회 불가.

기존 `folders` 컬럼이 같은 패턴 (`json("folders").$type<string[]>().default([])`) 으로 이미 사용 중 — JSON column 도입은 새 패턴 아님.

**플젝 컨벤션 (CLAUDE.md)**:
- DB schema 변경: `pnpm db:generate` 로 SQL 생성 → git 커밋 → `pnpm db:migrate` (apply)
- `pnpm db:push` 는 production 금지 — 마이그레이션 이력 누락 위험
- drizzle/ 디렉터리는 git 추적 (이미 `0001_*.sql ~ 0004_*.sql` 커밋됨)

## 작업 항목

### 1. `src/infra/db/schema/posts.ts` 컬럼 추가

기존 `folders` 정의 옆에 `tags`:

```ts
folders: json("folders").$type<string[]>().default([]),
tags: json("tags").$type<string[]>().notNull().default([]),
```

`notNull` 권장 — 빈 배열 default 로 모든 row 가 명시적 값 보유. JSON_CONTAINS 쿼리도 더 안전.

### 2. drizzle migration 생성 + 커밋

```bash
# cwd: <repo root>
pnpm db:generate
# drizzle/0005_*.sql 자동 생성 — ALTER TABLE posts ADD COLUMN tags JSON DEFAULT (...) NOT NULL;
```

생성된 SQL 파일 검토 (파괴적 변경 없음 — 단순 ADD COLUMN). 기존 row 는 default `[]` 자동 채움.

### 3. `src/services/SyncService.ts` 확장 — tags 추출 + 저장

**현재 동작 추정** (sync 시 frontmatter 파싱):
- markdown 파일 fetch
- `parseFrontMatter()` 로 frontmatter 추출
- title / description / category / subcategory 등 추출 후 DB upsert

**변경**:
- frontmatter 의 `tags` 도 추출. 타입은 `string[]` (이미 `parseFrontMatter` 가 `[a, b, c]` array literal 파싱 지원 — `src/lib/markdown.ts:45`)
- normalize: 모든 tag 를 `.trim().toLowerCase()` 처리 → 동일 글에서 중복 제거 (`Array.from(new Set(...))`)
- DB upsert payload 에 `tags` 추가
- frontmatter 에 tags 없으면 빈 배열 `[]`

executor 는 SyncService 코드를 먼저 읽고 (`grep -n "frontMatter\|description\|category" src/services/SyncService.ts`) tags 추출 위치를 정확히 파악 후 추가.

### 4. PostRepository upsert 메서드 시그니처 갱신

`src/infra/db/repositories/PostRepository.ts` 의 upsert / insert 메서드가 `NewPost` 타입을 받는다면 schema 변경으로 자동 호환. `Partial<UpdatePost>` 도 동일.

`tags` 가 explicit field 로 들어가야 하는 메서드가 있다면 (예: `createPost(payload)` 안에서 일부 필드만 명시적으로 destructure) tags 추가. grep 으로 영향 위치 확인.

### 5. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# schema
grep -n "tags:.*json" src/infra/db/schema/posts.ts

# migration
ls drizzle/ | grep -E "0005_.*\.sql"

# sync 확장
grep -n "tags" src/services/SyncService.ts
```

수동 smoke (사용자 안내 — production 영향 작업이라 dev DB 에서만 실행):
```bash
# dev DB 에 마이그레이션 적용
pnpm db:up
pnpm db:migrate

# 한 글 sync 테스트 → tags JSON 이 제대로 저장됐는지 확인
pnpm dev  # 별 터미널
curl -X POST http://localhost:3000/api/sync -H "Authorization: Bearer $SYNC_API_KEY"

# DB 직접 확인
mysql ... -e "SELECT path, tags FROM posts WHERE JSON_LENGTH(tags) > 0 LIMIT 5;"
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/infra/db/schema/posts.ts` | 수정 (tags 컬럼) |
| `drizzle/0005_*.sql` | 자동 생성 (커밋 필수) |
| `src/services/SyncService.ts` | 수정 (tags 추출) |
| `src/infra/db/repositories/PostRepository.ts` | 수정 (필요 시) |

## Out of Scope

- /tag/[name] 페이지 → phase 2
- ArticleFooter tag link → phase 2
- /tags 인덱스 페이지 (전체 tag 클라우드) — 결정으로 OOS
- tag 정규화 정책 (대소문자 / 한글-영문 동의어 매핑) — 단순 lowercase + trim 만

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| drizzle generate 결과의 SQL 이 NOT NULL DEFAULT JSON literal 미지원 (MySQL) | MySQL 8.4 는 JSON DEFAULT 지원하지만 expression 형태여야 함. 생성된 SQL 검토 — 깨지면 `default([])` 대신 nullable 후 inline 빈 배열 처리 |
| 기존 row 218개의 tags 가 default 로만 채워져 빈 배열 | sync 1회 실행으로 frontmatter tags 모두 백필. 사용자가 phase 1 완료 후 sync 호출 |
| frontmatter 의 tags 가 따옴표 없이 `[a, b]` 로 되어 array 파싱 실패 | `parseFrontMatter` 가 이미 array literal 처리 — 따옴표 제거 + split. 기존 동작 유지 |
| tags 가 한 글에서 수십 개일 때 storage 부담 | JSON 컬럼이라 길이 가변. 보통 글당 3~6개 — 무시 가능 |
