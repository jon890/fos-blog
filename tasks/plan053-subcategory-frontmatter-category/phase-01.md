# Phase 01 — category path 정규화와 sync 경고

**Model**: sonnet
**Status**: completed

---

## 목표

frontmatter `categories` 에 `AI/RAG` 같은 slash path가 들어와도 색상·아이콘이 최상위 카테고리 기준으로 안정적으로 fallback되게 한다.
또한 sync 단계에서 알려지지 않은 category key는 `warn` 로그로 드러낸다.

**범위 외**: `/category/[...path]` 페이지의 cross-post 조회 변경은 phase 02 책임이다.

---

## 배경

GitHub issue #180:

- ADR-030으로 frontmatter `categories`가 도입됐다.
- 현재 `RAW_TO_CANONICAL`과 `categoryIcons`는 대부분 최상위 폴더 기준이다.
- `categories: [AI/RAG]`가 UI 색상/아이콘 또는 canonical label에서 `system`으로 떨어질 수 있다.
- B안 결정: `AI/RAG` 같은 하위 폴더 경로를 실제 category key로 허용한다.

문서 결정:

- `docs/adr/030-multi-category.md`
- `docs/data-schema.md`
- `docs/code-architecture.md` 의 "하위 폴더 frontmatter category (plan053)"
- `docs/pages/category-detail.md`

---

## 작업 항목 (4)

### 1. `src/lib/category-meta.ts` — slash path fallback 추가

`toCanonicalCategory(raw: string)`가 아래 순서로 canonical category를 찾게 한다.

1. trim한 전체 key를 먼저 확인한다.
2. 전체 key가 없으면 `/` 앞 첫 segment를 확인한다.
3. 둘 다 없으면 `system`을 반환한다.

예상 동작:

- `toCanonicalCategory("AI/RAG")` → `ai`
- `toCanonicalCategory("database/opensearch")` → `db`
- `toCanonicalCategory("unknown/path")` → `system`

필요하면 `isKnownCategoryKey(raw: string): boolean` 같은 helper를 같은 파일에서 export한다.
이 helper는 sync 경고에서 재사용한다.

### 2. `src/infra/db/constants.ts` — 아이콘 fallback helper 추가

`categoryIcons[raw]` 직접 조회만으로는 임의 slash path를 처리할 수 없다.
다음 helper를 추가한다.

```ts
export function getCategoryIcon(category: string): string
```

동작:

1. trim한 전체 key가 `categoryIcons`에 있으면 해당 아이콘을 반환한다.
2. 없으면 `/` 앞 첫 segment의 아이콘을 반환한다.
3. 둘 다 없으면 `DEFAULT_CATEGORY_ICON`을 반환한다.

기존 `categoryIcons` export는 유지한다.

### 3. 아이콘 소비자 중 category path를 받을 수 있는 곳을 helper로 전환

최소 아래 파일을 확인한다.

- `src/components/PostCard.tsx`
- `src/app/api/og/posts/[...slug]/route.tsx`
- `src/app/api/og/category/[...path]/route.tsx`

`categoryIcons[category] ?? DEFAULT_CATEGORY_ICON` 또는 동등한 fallback이 있으면 `getCategoryIcon(category)`로 바꾼다.
`FolderSidebar`처럼 top-level tree data만 받는 코드도 grep 결과를 보고 필요하면 같이 전환한다.

### 4. sync 경고 추가

`mergeCategories(pathCategory, frontMatter.categories)` 결과 중 pathCategory 외 frontmatter 항목이 알려진 key로 해석되지 않으면 `warn` 로그를 남긴다.

적용 대상:

- `src/services/PostSyncService.ts`
- `src/services/SyncService.ts`

주의:

- `AI/RAG`는 `AI` prefix가 알려진 key라 경고하지 않는다.
- `database/opensearch`는 `database` prefix가 알려진 key라 경고하지 않는다.
- `unknown/path`는 경고한다.
- full sync와 incremental/upsert 양쪽 경로에서 누락되지 않아야 한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/lib/category-meta.ts` | slash path canonical fallback + 필요 시 known-key helper |
| `src/lib/category-meta.test.ts` | `AI/RAG`, `database/opensearch`, unknown path 테스트 |
| `src/infra/db/constants.ts` | `getCategoryIcon` helper |
| `src/infra/db/constants.test.ts` | slash path icon fallback 테스트 |
| `src/services/PostSyncService.ts` | frontmatter category warning |
| `src/services/PostSyncService.test.ts` | 경고 여부 테스트 |
| `src/services/SyncService.ts` | full/incremental sync warning |
| `src/components/PostCard.tsx` | 아이콘 helper 사용 |
| `src/app/api/og/posts/[...slug]/route.tsx` | 아이콘 helper 사용 |
| `src/app/api/og/category/[...path]/route.tsx` | 아이콘 helper 사용 |

---

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm test src/lib/category-meta.test.ts src/infra/db/constants.test.ts src/services/PostSyncService.test.ts
pnpm type-check

# slash path fallback 테스트가 실제로 추가됐는지 확인
grep -n "AI/RAG" src/lib/category-meta.test.ts src/infra/db/constants.test.ts src/services/PostSyncService.test.ts

# 직접 categoryIcons fallback 잔재 확인
grep -rn "categoryIcons\\[.*\\].*DEFAULT_CATEGORY_ICON\\|categoryIcons\\[.*\\] || DEFAULT_CATEGORY_ICON" src/ --include="*.ts" --include="*.tsx"
```

마지막 grep은 출력이 없어야 한다.
단 `categoryIcons`를 데이터 맵으로 전달하는 코드가 있으면 false positive가 아닌지 확인하고 phase 보고에 남긴다.

---

## 의도 메모 (왜)

- category key 저장값은 `AI/RAG`처럼 구체적으로 유지한다.
- 시각 표현은 canonical 9종을 늘리지 않고 첫 segment로 fallback한다.
- 알려지지 않은 category key는 운영자가 로그에서 확인할 수 있게 해 silent miss를 줄인다.

## Blocked 조건

- logger mock이 기존 테스트 구조상 안정적으로 검증되지 않으면 `PHASE_BLOCKED: logger warning 테스트 구조 결정 필요`를 보고한다.
