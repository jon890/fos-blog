# 카테고리 목록 — Page PRD

**Route:** `/categories`  
**File:** `src/app/categories/page.tsx`  
**Updated:** 2026-04-29

---

## Purpose

블로그의 모든 카테고리를 두 섹션 (Most active top-3 featured + All categories grid) 으로 보여주는 인덱스 페이지. plan015 (Claude Design 핸드오프) 기반 리디자인.

---

## Data

| Source | Method | Returns |
|--------|--------|---------|
| CategoryRepository | `getCategoriesWithLatest()` | 카테고리 목록 + 카테고리별 max(`posts.updatedAt`) (LEFT JOIN + GROUP BY) |

`postCount desc` 정렬 → `top3 = slice(0, 3)`, `rest = slice(3)`. sub-hero subline 의 `updated YYYY.MM.DD` 는 `max(latestUpdatedAt)` 로 계산.

**ISR:** `revalidate = 60`  
**Static params:** 없음

**에러 처리:** DB 에러 시 빈 배열로 폴백 — 빈 카테고리 목록 렌더링

---

## Components

| Component | Role |
|-----------|------|
| `Breadcrumb` | `fos-blog / categories` 네비 |
| `CategoriesSubHero` | eyebrow + h1 + sublines (개수 / 글 수 / updated) |
| `CategoriesSection` | 섹션 헤더 (idx + h2 + meta) helper |
| `CategoryFeatured` | top-3 featured 카드 (rank 배지 + tinted gradient) |
| `CategoryCard` | 일반 카테고리 카드 (좌 2px cat-color + hover blob) |

---

## Interactions

- **카테고리 카드 클릭**: `/category/<slug>` 이동 (각 카드 외곽 `<Link>`)
- **hover**: `-translate-y-0.5` lift + cat-color border + (CategoryCard) `::after` radial blob

---

## SEO

- `export const metadata` (정적): title="카테고리", canonical=`/categories`, og type=website
- JSON-LD 없음

---

## Related Files

- `src/app/categories/page.tsx`
- `src/components/Breadcrumb.tsx`
- `src/components/CategoriesSubHero.tsx`
- `src/components/CategoriesSection.tsx`
- `src/components/CategoryFeatured.tsx`
- `src/components/CategoryCard.tsx`
- `src/lib/subline.ts` — `SublinePart` 공유 타입
- `src/lib/time.ts` — `formatRelativeKo`, `formatYYYYMMDD`
- `src/lib/category-meta.ts` — `getCategoryColor`
- `src/infra/db/repositories/CategoryRepository.ts` — `getCategoriesWithLatest()`
- `src/infra/db/types.ts` — `CategoryData` 타입
- `src/app/globals.css` — `.cat-card::after` radial blob
