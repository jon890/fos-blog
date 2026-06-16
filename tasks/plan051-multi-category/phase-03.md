# Phase 03 — 카테고리 페이지(depth 1)에 cross-post 글 노출

**Model**: sonnet
**Status**: pending

---

## 목표

`/category/{name}`(depth 1) 페이지에 폴더 직속 글(기존, 경로 매칭)에 더해 **cross-post 글**을 합쳐 노출한다 (ADR-030).
cross-post = `categories` 에 `name` 을 포함하지만 primary `category` 가 `name` 이 아닌 글(= 경로상 다른 폴더에 있는 글).
폴더 브라우저(경로 매칭)와 하위 폴더 카드는 그대로 유지한다 — 경로 축과 카테고리 축을 분리해 회귀를 최소화한다.

**선행**: phase-01(컬럼), phase-02(저장).
**범위 외**: 배지 UI(phase-04), 연관 글(getRelatedPosts), `getCategoryStats` 다중 집계 — 모두 ADR-030 범위 제외.

---

## 작업 항목 (4)

### 1. `src/infra/db/repositories/PostRepository.ts` — `getCrossCategoryPosts` 메서드 추가

`categories` 에 인자 카테고리를 포함하지만 primary `category` 는 다른(= 폴더 밖) 활성 글을 반환한다.

```ts
async getCrossCategoryPosts(category: string): Promise<PostData[]>
```

조건:
- `JSON_CONTAINS(categories, ?)` — `categories` 에 `category` 포함. **기존 `getPostsByTag`(약 389번 줄)의 `JSON_CONTAINS` 작성 방식**(JSON_QUOTE 사용)을 같은 파일에서 확인해 동일하게 쓴다.
- `ne(posts.category, category)` — primary 가 이 카테고리가 아닌 것만(폴더 직속 글과 중복 방지). primary == category ⟺ 경로가 `category/` 로 시작이므로, 이 조건이 "폴더 밖" 을 정확히 거른다.
- `eq(posts.isActive, true)`.

select 에 PostData 표시 필드 + `categories: posts.categories` 를 포함한다(배지·노출용). `getPostsBySeries` 의 select/map 패턴을 참고한다.

> 주의: 죽은 `getPostsByCategory` 는 건드리지 않는다(프로덕션 호출자 0개, 외과적 변경 원칙). 노출은 이 신규 메서드로만 배선한다.

### 2. `src/infra/db/repositories/FolderRepository.ts` — postsData 에 categories 포함

`getFolderContents` 는 이미 `select()`(전체 컬럼)로 categories 를 가져오지만, `postsData` 매핑(약 49~57번 줄)에서 누락한다.
매핑에 `categories: p.categories` 를 추가해 폴더 직속 글도 categories 를 싣는다(phase-04 배지·정합).

### 3. `src/app/category/[...path]/page.tsx` — depth 1 에서 cross-post 병합

`FolderPage` 에서 `pathSegments.length === 1` 일 때만 cross-post 글을 조회해 `posts` 목록에 합친다.

```ts
// depth 1 (카테고리 루트)일 때만 cross-post 병합
let mergedPosts = posts;
if (pathSegments.length === 1) {
  const { post } = getRepositories();
  const crossPosts = await post.getCrossCategoryPosts(category);
  const seen = new Set(posts.map((p) => p.path));
  mergedPosts = [...posts, ...crossPosts.filter((p) => !seen.has(p.path))];
}
```

이후 "이 폴더의 글" 렌더(`posts.map`)와 글 수 표시(`posts.length`)가 `mergedPosts` 를 쓰도록 바꾼다.
DB 미가용 fallback(`getCachedFolderContents` 의 catch) 경로는 그대로 둔다 — cross-post 조회 실패가 페이지를 깨지 않도록 `getCrossCategoryPosts` 호출도 안전하게(빈 배열 fallback) 감싼다.

### 4. depth ≥ 2 + getCategoryStats 무변경 확인

```bash
# cwd: <repo root>
grep -n "getCategoryStats" src/infra/db/repositories/PostRepository.ts   # groupBy(category) 그대로 — 변경 없음 확인
grep -rn "getFolderContents" src/app/category/ | grep -v test            # 폴더 브라우저 호출 유지 확인
```

depth ≥ 2(`/category/AI/LLM`)는 cross-post 병합을 타지 않아 순수 폴더 탐색이 유지된다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/infra/db/repositories/PostRepository.ts` | 수정 — getCrossCategoryPosts 신규 |
| `src/infra/db/repositories/FolderRepository.ts` | 수정 — postsData 에 categories |
| `src/app/category/[...path]/page.tsx` | 수정 — depth 1 cross-post 병합 |

## 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run

grep -n "getCrossCategoryPosts" src/infra/db/repositories/PostRepository.ts   # 메서드 정의
grep -n "getCrossCategoryPosts" src/app/category/\[...path\]/page.tsx          # 페이지 배선
grep -n "JSON_CONTAINS" src/infra/db/repositories/PostRepository.ts           # cross-post 조회
grep -n "categories: p.categories" src/infra/db/repositories/FolderRepository.ts
```

수동 smoke (`pnpm dev`, MySQL + 로컬 sync 필요):
- `AI/...` 경로 테스트 글에 frontmatter `categories: [DevOps]` 추가 후 sync
- `/category/DevOps` 에 그 글이 cross-post 로 노출되는지 (DevOps 폴더 직속 글 + 그 글)
- `/category/AI` 는 기존과 동일하게 보이는지(직속 글, cross-post 없으면 변화 0)
- `/category/AI/LLM`(depth 2) 폴더 탐색이 그대로인지

## 의도 메모 (왜)

- `ne(posts.category, category)` 로 폴더 밖만 거르는 이유: primary category 가 경로 첫 폴더라, primary == name 인 글은 이미 폴더 직속·하위 폴더로 노출된다. 이중 노출·중복을 막고 "직속 + 타카테고리"(사용자 결정)를 정확히 구현한다.
- 폴더 브라우저를 교체하지 않는 이유: 경로 계층(하위 폴더 카드·deep path)과 카테고리 다중 소속은 다른 축이다. 섞으면 한 글이 잘못된 폴더에 뜨는 회귀가 생긴다(ADR-030 대안 기각).
- depth 1 로 한정하는 이유: 카테고리는 경로 첫 폴더 단위 개념이라 다중 소속도 1-depth 에서만 의미가 있다. 깊은 폴더는 순수 경로 탐색.
