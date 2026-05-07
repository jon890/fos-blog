# 홈 — Page PRD

**Route:** `/`  
**File:** `src/app/page.tsx`  
**Updated:** 2026-05-07

---

## Purpose

블로그의 메인 랜딩 페이지. 카테고리 목록, 인기 글, 최근 글, 통계를 보여주며 방문자가 원하는 콘텐츠로 빠르게 이동하도록 돕는다.

---

## Data

| Source | Method | Returns |
|--------|--------|---------|
| CategoryRepository | `getCategories()` | 전체 카테고리 목록 + 글 수 |
| PostRepository | `getRecentPosts(6)` | 최근 글 6개 |
| CategoryRepository | `getCategories()` | postCount desc 정렬 — 홈에서 상위 9개 표시 (plan030) |
| PostRepository | `getActivePostCount()` | HomeHero 통계용 활성 글 총 개수 (plan013) |
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
| `HomeHero` (plan013) | eyebrow + h1 + lead + `<dl>` 4 stats 한 컴포넌트 — 기존 별도 Hero/Stats 섹션 통합 |
| `HeroMesh` (plan013) | SVG `<radialGradient>` + CSS slow rotate 배경 mesh (server, prefers-reduced-motion 자동 처리) |
| `CategoryList` | 카테고리 그리드 (최대 9개 표시, lg 3×3) |
| `PostCard` | 인기 글 / 최근 글 카드 |
| `WebsiteJsonLd` | JSON-LD 구조화 데이터 |

---

## Interactions

- **카테고리 카드 클릭**: `/category/<slug>` 이동
- **카테고리 섹션 "모두 보기" 링크**: `/categories` 이동
- **"인기 글 더 보기" CTA 버튼** (섹션 하단): `/posts/popular` 이동
- **"최신 글 더 보기" CTA 버튼** (섹션 하단): `/posts/latest` 이동
- **PostCard 클릭**: `/posts/<path>` 이동

※ 카테고리 섹션은 헤더 우측 "모두 보기 →" 링크, 글 섹션은 섹션 하단 큰 CTA 버튼 — [ADR-003](../adr.md#adr-003)

---

## SEO

- `WebsiteJsonLd`: name="FOS Study", description, url
- 별도 `generateMetadata` / `export const metadata` 없음 (루트 layout.tsx의 default metadata 사용)

---

## Layout

```
HomeHero (eyebrow + h1<em> + caret + lead + <dl> 4 stats)  ← plan013, HeroMesh 배경 포함
Popular Posts Section (인기 글, 조회수 있을 때만 표시)
  └ 섹션 하단 CTA 버튼 "인기 글 더 보기 →"
Recent Posts Section (최근 6개)
  └ 섹션 하단 CTA 버튼 "최신 글 더 보기 →"
Categories Section (최대 9개, 3×3 grid → 헤더 우측 "모두 보기" 링크)  ← plan030
```

> plan030: 인기/최신을 카테고리보다 위로 올려 신규 방문자가 콘텐츠를 먼저 만나도록 재배치. 카테고리는 6→9로 확장하여 3×3 grid 로 표시.

> plan013 이전: 별도 Hero Section + Stats Section 으로 분리되어 있었음. 현재는 `<HomeHero>` 한 컴포넌트로 통합 — eyebrow, h1, lead, 4 stats `<dl>` (posts/categories/series·subscribers placeholder).

---

## Related Files

- `src/app/page.tsx`
- `src/components/HomeHero.tsx` (plan013)
- `src/components/HeroMesh.tsx` (plan013)
- `src/components/CategoryList.tsx`
- `src/components/PostCard.tsx`
- `src/components/SectionCTAButton.tsx`
- `src/components/JsonLd.tsx`
- `src/infra/db/repositories/CategoryRepository.ts`
- `src/infra/db/repositories/PostRepository.ts`
- `src/infra/db/repositories/VisitRepository.ts`
