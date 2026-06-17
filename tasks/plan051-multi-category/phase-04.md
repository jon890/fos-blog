# Phase 04 — 글 카드·상세·검색에 다중 카테고리 배지

**Model**: sonnet
**Status**: pending

---

## 목표

글 카드(`PostCard`)·글 상세 헤더·검색 결과에서 단일 `category` chip 을 `categories` 배열 전체 배지로 표시한다 (ADR-030).
한 글이 속한 모든 카테고리를 노출한다. 첫 요소(primary)는 기존 위치·스타일을 유지해 단일 카테고리 글의 시각 변화를 0 으로 만든다.

**선행**: phase-02(categories 저장), phase-03(노출).
**범위 외**: 카테고리 페이지 글 목록 행(`PostListRow`)의 출처 배지 — 별도 후속. `CategoryList`(카테고리 나열 자체)는 글 배지가 아니라 제외.

---

## 작업 항목 (4)

### 1. `src/components/PostCard.tsx` — 단일 chip → categories 다중 chip

현재 단일 chip 을 그리는 3곳(grid variant / row 모바일 / row 데스크톱)을 `cats.map(...)` 으로 바꿔 각 카테고리를 chip 으로 렌더한다.

```ts
const cats = post.categories?.length ? post.categories : [post.category];
```

- 각 chip 색은 **`getCategoryColor(name)`** 적용(이미 import 됨). `getCategoryHex`(og-palette, OG 이미지용) 아님.
- **chip 표시 형식을 기존과 동일하게 유지**: 현재 단일 chip 은 `toCanonicalCategory(post.category)` 로 라벨을 만들고(일부 위치는 `getCategoryIcon` 도 사용). 다중 chip 의 각 항목에도 `toCanonicalCategory(name)`(+ 기존에 아이콘을 쓰던 위치면 `getCategoryIcon(name)`)를 동일 적용해 표시 형식이 어긋나지 않게 한다. 기존에 쓰던 헬퍼는 grep 으로 각 chip 위치에서 확인.
- 첫 요소(primary)는 기존 단일 표시와 동일 위치·스타일 유지. 나머지는 이어서 표시.
- chip 컨테이너에 `flex-wrap` + gap 을 둬 여러 개일 때 줄바꿈 처리.
- PostCard 의 chip 은 카드 전체 `<Link>` 안에 있으므로 **개별 링크로 만들지 않는다**(중첩 anchor 금지) — 표시 전용.

### 2. 글 상세 헤더 — 다중 chip

`src/app/posts/[...slug]/page.tsx` 에서 글의 카테고리를 표시하는 부분을 grep 으로 찾아 `categories` 다중 표시로 바꾼다.

```bash
# cwd: <repo root>
grep -n "category\|getCategoryColor\|categorySlug" src/app/posts/\[...slug\]/page.tsx
```

상세 헤더의 카테고리 chip 이 클릭 가능하면 각 카테고리를 `/category/{name}` 으로 링크한다(기존 단일 링크 형식을 같은 파일에서 확인해 동일 규칙 적용). fallback 은 작업 1 과 동일(`categories?.length ? ... : [category]`).

### 3. `src/components/SearchDialog.tsx` — 검색 결과 다중 chip

검색 결과 항목의 단일 category 표시를 categories 다중으로 바꾼다. 먼저 표시 위치를 grep 으로 특정한다.

```bash
# cwd: <repo root>
grep -n "category\|getCategoryColor\|getCategoryIcon\|toCanonicalCategory" src/components/SearchDialog.tsx
```

category chip 표시가 있으면 다중으로 교체(동일 fallback 적용). **표시가 전혀 없으면 침묵으로 건너뛰지 말고**, phase 완료 보고에 "SearchDialog 에 category chip 없음 — 변경 불필요" 를 명시한다(실행자가 못 찾아 누락한 것인지, 원래 없는 것인지 구분).

### 4. 노출 면 query 에 categories select 추가

위 3개 면에 데이터를 공급하는 PostData 조회에 `categories: posts.categories` 를 select 에 추가한다(없으면 optional 이라 undefined → 단일 fallback 되어 다중 배지가 안 뜸).

```bash
# cwd: <repo root>
# 홈/최신글(PostCard), 검색(searchPosts), 상세 로딩에 쓰이는 PostData 조회 메서드 특정
grep -n "category: posts.category" src/infra/db/repositories/PostRepository.ts
```

대상은 **PostData 를 반환해 위 3개 면에 쓰이는 메서드만**. 다음은 **반드시 제외**한다(추가 시 오류·무의미):
- `getCategoryStats` — `groupBy(posts.category)` 집계라 categories select 추가 시 MySQL `ONLY_FULL_GROUP_BY` 런타임 오류.
- 시리즈 `firstPost` mini-select / `getRelatedPosts` 후보 select — 본 plan 범위 밖, 표시 면 아님.

각 대상 메서드의 select + map 에 categories 를 추가한다(`getPostsBySeries` 의 select/map 패턴 참고).

**누락 0 으로 추적**: 3개 면(홈/최신글 카드, 검색, 상세)이 각각 어느 PostRepository 메서드에서 PostData 를 받는지 호출 체인을 grep 으로 끝까지 추적해(예: 홈 page → service → repository), 그 면을 공급하는 메서드를 **모두** 고친다. 한 면이라도 공급 메서드를 빠뜨리면 그 면의 다중 배지가 안 뜬다(optional 이라 빌드·테스트는 통과 → 런타임 표시 누락만 발생). 특정한 대상 메서드 목록을 phase 완료 보고에 적는다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/components/PostCard.tsx` | 수정 — 다중 chip (3곳) |
| `src/app/posts/[...slug]/page.tsx` | 수정 — 상세 헤더 다중 chip |
| `src/components/SearchDialog.tsx` | 수정 — 검색 결과 다중 chip(해당 시) |
| `src/infra/db/repositories/PostRepository.ts` | 수정 — 표시 면 query 에 categories select |

## 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run

grep -rn "categories?.length\|cats.map\|categories.map" src/components/PostCard.tsx   # 다중 렌더
! grep -n "getCategoryHex" src/components/PostCard.tsx                                 # OG 팔레트 오용 없음(exit 1 기대)
grep -c "categories: posts.categories" src/infra/db/repositories/PostRepository.ts    # 표시 면 select 추가 1건 이상
# getCategoryStats 는 categories 미포함 유지(groupBy 보호)
grep -A8 "async getCategoryStats" src/infra/db/repositories/PostRepository.ts | grep -c "categories: posts.categories"   # 0 기대
```

수동 smoke (`pnpm dev`, MySQL + 로컬 sync 필요):
- `categories: [DevOps, Backend]` 넣은 글 카드에 배지 3개(경로 + 2개) 노출
- 다크/라이트 모드에서 배지 색·대비 확인(정의된 9색 외 카테고리는 fallback 색)
- 배지 여러 개일 때 카드 레이아웃 줄바꿈 정상

## 의도 메모 (왜)

- primary(첫 요소)를 기존 위치에 유지해 단일 카테고리 글(대부분의 기존 글)의 시각 변화를 0 으로 만든다.
- `getCategoryColor`(category-meta) 사용 — `getCategoryHex`(og-palette)는 OG 이미지 전용이라 UI chip 에 쓰면 색 체계가 어긋난다.
- categories select 를 표시 면 query 에만 한정 + groupBy 집계 제외 — 광범위 추가는 `ONLY_FULL_GROUP_BY` 런타임 오류를 부른다(빌드는 통과, 런타임에만 터짐).
