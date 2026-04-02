# 홈 — Page PRD

**Route:** `/`  
**File:** `src/app/page.tsx`  
**Updated:** 2026-04-02

---

## Purpose

블로그의 메인 랜딩 페이지. 카테고리 목록, 인기 글, 최근 글, 통계를 보여주며 방문자가 원하는 콘텐츠로 빠르게 이동하도록 돕는다.

---

## Data

| Source | Method | Returns |
|--------|--------|---------|
| CategoryRepository | `getCategories()` | 전체 카테고리 목록 + 글 수 |
| PostRepository | `getRecentPosts(6)` | 최근 글 6개 |
| VisitRepository | `getPopularPostPaths(limit*3)` | 인기 글 경로 + 조회수 |
| PostRepository | `getPostsByPaths(paths)` | 인기 글 상세 데이터 |
| VisitRepository | `getPostVisitCounts(postPaths)` | 최근 글 조회수 맵 |

**ISR:** `revalidate = 60`  
**Static params:** 없음

**에러 처리:** DB 에러 시 빈 배열로 폴백 — 빈 화면으로 렌더링됨 (notFound 없음)

---

## Components

| Component | Role |
|-----------|------|
| `CategoryList` | 카테고리 그리드 (최대 6개 표시) |
| `PostCard` | 인기 글 / 최근 글 카드 |
| `WebsiteJsonLd` | JSON-LD 구조화 데이터 |

---

## Interactions

- **카테고리 카드 클릭**: `/category/<slug>` 이동
- **"모두 보기" 링크**: `/categories` 이동
- **PostCard 클릭**: `/posts/<path>` 이동

---

## SEO

- `WebsiteJsonLd`: name="FOS Study", description, url
- 별도 `generateMetadata` / `export const metadata` 없음 (루트 layout.tsx의 default metadata 사용)

---

## Layout

```
Hero Section (제목 + 설명)
Categories Section (최대 6개 → "모두 보기" 링크)
Popular Posts Section (인기 글, 조회수 있을 때만 표시)
Recent Posts Section (최근 6개)
Stats Section (카테고리 수 / 전체 글 수 / "계속 성장 중")
```

---

## Related Files

- `src/app/page.tsx`
- `src/components/CategoryList.tsx`
- `src/components/PostCard.tsx`
- `src/components/JsonLd.tsx`
- `src/infra/db/repositories/CategoryRepository.ts`
- `src/infra/db/repositories/PostRepository.ts`
- `src/infra/db/repositories/VisitRepository.ts`
