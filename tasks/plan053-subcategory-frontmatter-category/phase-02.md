# Phase 02 — 하위 폴더 cross-post 조회와 통합 검증

**Model**: sonnet
**Status**: completed

---

## 목표

`categories: [AI/RAG]`로 지정된 글이 `/category/AI/RAG` 페이지에 cross-post로 노출되게 한다.
기존 폴더 브라우저 동작과 SEO noindex 가드는 유지한다.

**범위 외**: `/categories` landing count의 다중 집계, `getRelatedPosts`의 다중 카테고리 점수화는 ADR-030 범위 제외를 유지한다.

---

## 배경

현재 `src/app/category/[...path]/page.tsx`는 depth 1일 때만 `post.getCrossCategoryPosts(category)`를 호출한다.
이 때문에 `AI/RAG` 같은 하위 폴더 category key는 저장되어도 `/category/AI/RAG` 페이지에서 cross-post로 병합되지 않는다.

B안 결정:

- 현재 folder path 전체를 cross-post key로 사용한다.
- 폴더 직속 글은 `FolderRepository.getFolderContents(folderPath)`가 계속 담당한다.
- cross-post는 `posts.categories`에 `folderPath`가 있으면서, 실제 `posts.path`가 `${folderPath}/` prefix에 속하지 않는 글만 가져온다.
- page layer에서 path 기준으로 중복 제거한다.

---

## 작업 항목 (4)

### 1. `PostRepository.getCrossCategoryPosts`를 folderPath 기준으로 변경

`src/infra/db/repositories/PostRepository.ts`의 `getCrossCategoryPosts`를 현재 폴더 경로 전체 기준으로 동작하게 한다.

필수 조건:

- `JSON_CONTAINS(posts.categories, JSON_QUOTE(folderPath))`
- `posts.isActive = true`
- `posts.path`가 `${folderPath}/`로 시작하는 글은 제외

기존 `ne(posts.category, category)`는 depth 1만 표현하므로 교체한다.
SQL escaping은 Drizzle parameter binding 또는 안전한 `sql` interpolation을 사용한다.

### 2. `/category/[...path]` page에서 모든 depth에 cross-post 병합

`src/app/category/[...path]/page.tsx`의 depth 1 제한을 제거한다.

동작:

- `folderPath = pathSegments.join("/")`를 `getCrossCategoryPosts(folderPath)`에 전달한다.
- `getFolderContents(folderPath)` 결과와 cross-post 결과를 path 기준으로 중복 제거한다.
- 에러 시 기존처럼 warn 로그 후 cross-post 없이 렌더한다.
- `notFound()` 판단은 merged posts 기준으로 유지한다.

### 3. 테스트 추가

가능한 최소 단위 테스트를 추가한다.

후보:

- `PostRepository.getCrossCategoryPosts("AI/RAG")`가 `JSON_CONTAINS(categories, JSON_QUOTE("AI/RAG"))`와 path prefix 제외 조건을 만든다는 repository 테스트.
- page 단위 테스트가 없으면 repository SQL 조건 테스트 또는 integration 성격의 mock 테스트를 선택한다.

테스트가 현재 repository mock 구조상 어렵다면 helper를 추출해 순수 함수로 검증한다.
단 검증 없이 구현만 두지 않는다.

### 4. 마지막 상태 마킹

구현과 검증이 통과하면 `tasks/plan053-subcategory-frontmatter-category/index.json`에서:

- phase 01 status를 `completed`로 바꾼다.
- phase 02 status를 `completed`로 바꾼다.
- top-level status를 `completed`로 바꾼다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/infra/db/repositories/PostRepository.ts` | folderPath 기반 cross-post 조회 |
| `src/app/category/[...path]/page.tsx` | 모든 depth에서 cross-post 병합 |
| `src/infra/db/repositories/PostRepository.test.ts` 또는 관련 테스트 파일 | 하위 folderPath cross-post 조건 검증 |
| `tasks/plan053-subcategory-frontmatter-category/index.json` | 완료 상태 마킹 |

---

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm test src/lib/category-meta.test.ts src/infra/db/constants.test.ts src/services/PostSyncService.test.ts
pnpm test src/infra/db/repositories/PostRepository.test.ts
pnpm lint
pnpm type-check
pnpm build

# depth 1 제한 제거 확인
! grep -n "pathSegments.length === 1" 'src/app/category/[...path]/page.tsx'

# folderPath 기반 호출 확인
grep -n "getCrossCategoryPosts(folderPath)" 'src/app/category/[...path]/page.tsx'

# 완료 상태 마킹 확인
grep -n '"status": "completed"' tasks/plan053-subcategory-frontmatter-category/index.json
```

`PostRepository.test.ts`가 존재하지 않거나 새로 만들기 어렵다면, 실제 추가한 repository 테스트 파일 경로로 두 번째 `pnpm test` 명령을 바꾼다.
검증 명령 변경 사유는 phase 보고에 남긴다.

---

## 의도 메모 (왜)

- `AI/RAG`는 UI 표현용 alias가 아니라 실제 category key다.
- 폴더 브라우저는 path prefix 기반으로 유지한다.
- cross-post는 "현재 폴더 밖에 있지만 이 folderPath category에 속한 글"만 더한다.
- `/categories` landing count와 related posts는 ADR-030의 범위 제외를 유지해 변경 범위를 제한한다.

## Blocked 조건

- DB repository 테스트에서 JSON SQL 조건을 안정적으로 검증할 수 없으면 `PHASE_BLOCKED: PostRepository cross-post SQL 테스트 방식 결정 필요`를 보고한다.
