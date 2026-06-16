# Phase 04 — 글 카드/상세에 다중 카테고리 배지 표시

**Model**: sonnet
**Status**: pending

---

## 목표

글 카드와 글 상세에서 단일 `category` chip 을 `categories` 배열 전체로 표시한다.
한 글이 속한 모든 카테고리를 배지로 노출한다 (ADR-030).

**선행**: phase-02(categories 저장 + select), phase-03(조회).
**범위 외**: 카테고리 목록 페이지 자체(CategoryList — 글 배지가 아니라 카테고리 나열), 연관 글.

---

## 작업 항목 (4)

### 1. 카테고리 chip 표시 위치 특정

글의 카테고리를 chip/badge 로 보여주는 컴포넌트를 grep 으로 찾는다.

```bash
# cwd: <repo root>
grep -rn "\.category\b\|getCategoryHex\|categoryHref" src/components/ src/app/posts/ | grep -v test
```

글 단위 배지를 그리는 컴포넌트(예: `PostCard.tsx`, 글 상세 헤더, `SearchDialog.tsx` 결과 항목)를 대상으로 한다. 카테고리 자체를 나열하는 `CategoryList.tsx` 는 제외한다.

### 2. 단일 chip → categories 다중 chip 렌더

대상 컴포넌트에서 `post.category` 하나를 그리던 부분을 `post.categories.map(...)` 으로 바꿔 각 카테고리를 chip 으로 렌더한다.

- 각 chip 색상은 기존 `getCategoryHex(name)` 적용 — 정의된 9개는 고유색, 그 외(frontmatter 자유 카테고리)는 fallback 색이 나오는지 확인한다.
- 첫 요소(primary)는 기존 단일 표시와 동일한 위치/스타일을 유지해 시각 회귀를 최소화한다.
- 레이아웃이 깨지지 않게 chip 컨테이너에 `flex-wrap`/gap 을 둔다(여러 개 배지).

### 3. 카테고리 링크 일관성

chip 이 클릭 가능하면 각 카테고리로 링크한다. 기존 단일 category 링크 생성 방식(`categoryHref` 또는 `/category/...`)을 같은 코드베이스에서 확인해 동일 규칙으로 각 카테고리에 적용한다. 링크 생성 헬퍼가 없으면 기존 단일 링크와 같은 형식을 따른다.

### 4. categories 빈 배열 방어

`post.categories` 가 비었거나 없을 때(이론상 backfill 로 최소 1개지만) `category` 단일로 fallback 한다.

```ts
const cats = post.categories?.length ? post.categories : [post.category];
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/components/PostCard.tsx` | 수정 — 다중 chip (grep 으로 최종 확정) |
| 글 상세 헤더 컴포넌트 | 수정 — 다중 chip |
| `src/components/SearchDialog.tsx` | 수정 — 검색 결과 다중 chip(해당 시) |

> 정확한 대상은 작업 1 의 grep 결과로 확정한다. chip 을 그리지 않는 컴포넌트는 건드리지 않는다.

## 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run

grep -rn "categories.map\|categories?.length" src/components/ src/app/posts/ | grep -v test   # 다중 렌더 적용 확인
```

수동 smoke (`pnpm dev`, MySQL + 로컬 sync 필요):
- `categories: [DevOps, Backend]` 를 넣은 테스트 글 카드에 배지 3개(경로 + 2개)가 보이는지
- 다크/라이트 모드 양쪽에서 배지 색·대비 확인
- 배지가 여러 개일 때 카드 레이아웃이 줄바꿈으로 정상 처리되는지

## 의도 메모 (왜)

- primary(첫 요소)를 기존 위치에 유지해 단일 카테고리 글의 시각 변화를 0 으로 만든다 — 대부분의 기존 글은 카테고리 1개라 회귀 영향이 없어야 한다.
- getCategoryHex fallback 확인이 중요 — frontmatter 자유 카테고리는 정의된 9색에 없으므로 fallback 이 없으면 색이 깨진다.
