# Phase 03 — data-schema.md 5개 테이블 추가 + flow.md 라우트 보강

**Model**: sonnet
**Goal**: data-schema.md 가 plan014 변경 노트에서 전체 스키마 레퍼런스로 격상. flow.md 에 contact/privacy/tag 라우트 추가.

## Context (자기완결)

audit 결과:

**data-schema.md 부패** — 실제 `src/infra/db/schema/`에 7개 테이블이 있으나 docs 는 `posts`/`visit_stats` 만 등재. 5개 미문서화:

| 테이블 | 스키마 파일 | 역할 |
|---|---|---|
| `folders` | `src/infra/db/schema/folders.ts` | 카테고리 폴더 트리 |
| `categories` | `src/infra/db/schema/categories.ts` | 카테고리 메타 (slug / 표시명 / hue) |
| `comments` | `src/infra/db/schema/comments.ts` | 댓글 |
| `sync_logs` | `src/infra/db/schema/syncLogs.ts` | sync 실행 로그 |
| `visit_logs` | `src/infra/db/schema/visitLogs.ts` | visit 추적 raw 로그 |

**flow.md 부패** — `/about`, `/categories`, `/category/[...path]`, `/posts/[...slug]`, `/posts/latest`, `/posts/popular` 는 기재됨. **누락**: `/contact`, `/privacy`, `/tag/[name]`. AdSense 승인 요건 (ADR-014 등) 관련 페이지라 진입 경로 기재 필요.

## 작업 항목

### 1. 5개 schema 파일 grep 으로 컬럼 / 제약 / 관계 파악

```bash
# cwd: <worktree root>
for f in folders categories comments syncLogs visitLogs; do
  echo "=== $f ==="
  cat src/infra/db/schema/$f.ts
  echo ""
done
```

각 테이블의 컬럼명 / 타입 / NOT NULL / UNIQUE / INDEX / FOREIGN KEY 추출.

### 2. data-schema.md 에 5개 섹션 추가

기존 `posts` / `visit_stats` 섹션 하단에 동일 패턴으로 5개 섹션 추가. 각 섹션 형식:

```markdown
### `<table_name>`

용도: <한 줄>

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| ... | ... | ... | ... |

관계 (있는 경우):
- `<column>` → `<other_table>.<column>` (FK / 논리적 관계)

인덱스:
- `<index_name>` on `(col1, col2)` — 사용 쿼리 패턴

Notes (의사결정 의도가 있는 경우):
- ...
```

5개 테이블 모두 동일 형식.

### 3. data-schema.md 의 plan014 변경 노트 정리

기존 docs 가 plan014 변경 노트 성격이라면 상단 섹션을 "스키마 레퍼런스 + 변경 이력" 구조로 재정리. 변경 이력은 ADR 참조 또는 git log 로 위임 — docs 에서 narrative 제거.

### 4. flow.md 에 contact / privacy / tag 라우트 추가

`/contact`, `/privacy`, `/tag/[name]` 진입 경로 + 1-2 줄 설명. 기존 라우트 표 또는 그래프에 자연스럽게 삽입.

```bash
grep -n "/posts\|/about\|/categories" docs/flow.md | head
```

기존 패턴 확인 후 동일 형식으로 추가.

### 5. 자동 verification

```bash
# cwd: <worktree root>

# Drizzle schema ↔ data-schema.md 정합 (audit 검증)
SCHEMA=$(grep -oE 'mysqlTable\("[a-z_]+"' src/infra/db/schema/*.ts | grep -oE '"[a-z_]+"' | tr -d '"' | sort -u)
DOC=$(grep -oE '^### `[a-z_]+`' docs/data-schema.md | tr -d '`#' | tr -d ' ' | sort -u)
diff <(echo "$SCHEMA") <(echo "$DOC") && echo "OK: data-schema sync"

# flow.md 에 신규 라우트 등장 확인
grep -E "/contact|/privacy|/tag" docs/flow.md && echo "OK: flow routes added"
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `docs/data-schema.md` | 수정 (5 섹션 추가 + 상단 정리) |
| `docs/flow.md` | 수정 (3 라우트 추가) |

## Out of Scope

- 스키마 파일 자체 변경 (코드 수정 0건)
- migration SQL 변경
- 다른 docs (code-architecture / pages) 갱신

## Risks

| 리스크 | 완화 |
|---|---|
| schema 파일에 inferSelect / inferInsert 보일러플레이트 등 시각 노이즈 | 컬럼 / 제약 / 인덱스만 추출, type alias 는 docs 미반영 |
| 5개 테이블 분량이 phase-03 전체 5 step 안에 들어가야 함 | step 2 가 5개 섹션 작성을 모두 포함 — 한 step 안에서 처리 (한 section 당 ~10줄 이내 응축) |
| FK / 논리적 관계 추출이 schema 만으로 모호 | 코드 검색 (PostRepository / SyncService 의 join 패턴) 으로 보강 — agent 가 도메인 지식으로 판단 |
