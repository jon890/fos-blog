# 카테고리 목록 — Page PRD

**Route:** `/categories`  
**File:** `src/app/categories/page.tsx`  
**Updated:** 2026-04-02

---

## Purpose

블로그의 모든 카테고리를 그리드 형태로 나열하는 페이지. 각 카테고리별 글 수를 표시하고 해당 카테고리 상세로 이동하는 진입점 역할을 한다.

---

## Data

| Source | Method | Returns |
|--------|--------|---------|
| CategoryRepository | `getCategories()` | 카테고리 목록 (slug, name, count) |

**ISR:** `revalidate = 60`  
**Static params:** 없음

**에러 처리:** DB 에러 시 빈 배열로 폴백 — 빈 카테고리 목록 렌더링

---

## Components

| Component | Role |
|-----------|------|
| `CategoryList` | 카테고리 카드 그리드 |

---

## Interactions

- **카테고리 카드 클릭**: `/category/<slug>` 이동 (CategoryList 내부 처리)

---

## SEO

- `export const metadata` (정적): title="카테고리", canonical=`/categories`, og type=website
- JSON-LD 없음

---

## Related Files

- `src/app/categories/page.tsx`
- `src/components/CategoryList.tsx`
- `src/infra/db/repositories/CategoryRepository.ts`
- `src/infra/db/types.ts` — `CategoryData` 타입
