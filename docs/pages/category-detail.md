# 카테고리/폴더 상세 — Page PRD

**Route:** `/category/[...path]`  
**File:** `src/app/category/[...path]/page.tsx`  
**Updated:** 2026-04-29

---

## Purpose

특정 카테고리 또는 하위 폴더의 내용을 보여주는 페이지. tinted sub-hero (좌 2px cat-color + 5% gradient), README frame, 하위 폴더 카드, post list row 를 표시한다. 다단계 중첩 경로를 지원한다. plan015 기반 리디자인.

---

## Data

| Source | Method | Returns |
|--------|--------|---------|
| FolderRepository | `getFolderContents(folderPath)` | `{ folders, posts, readme }` |

`folderPath` = `pathSegments.join("/")`  
`pathSegments` = URL 세그먼트 배열 (decodeURIComponent 처리)

**ISR:** `revalidate = 60`  
**Static params:** `generateStaticParams()` — `computeFolderPaths(post.getAllPostPaths())` 로 생성

**에러 처리:**
- DB 에러 시 빈 폴더 컨텐츠로 폴백
- `folders`, `posts`, `readme` 모두 없으면 `notFound()`

---

## Components

| Component | Role |
|-----------|------|
| `Breadcrumb` | 다단계 경로 네비 (`fos-blog / categories / ... / current`) |
| `CategoryDetailSubHero` | tinted sub-hero (좌 2px cat-color + gradient bg) |
| `CategoriesSection` | 섹션 헤더 helper |
| `ReadmeFrame` | README.md frame (file + ext head + body wrapper) |
| `MarkdownRenderer` | README.md 본문 렌더링 (있을 때만) |
| `SubfolderCard` | 하위 폴더 카드 (folder icon + name + count + ↗) |
| `PostListRow` | 글 목록 row (60px num / 1fr title+excerpt / 90px date+rel) |
| `BreadcrumbJsonLd` | JSON-LD 브레드크럼 (SEO 그대로 유지) |

---

## Interactions

- **Breadcrumb 링크**: 경로 중간 세그먼트 / `/categories` / `/` 이동
- **하위 폴더 카드 클릭**: `/category/<folder.path>` 이동 (`-translate-y-0.5` lift + cat-color border + ↗ translate)
- **PostListRow 클릭**: `/posts/<post.path>` 이동
- **PostListRow hover**: 좌 border cat-color + bg `color-mix(in oklch, var(--cat-color), transparent 96%)` (globals.css `.post-list-row:hover` 규칙)

---

## SEO

- `generateMetadata()`: title=currentFolder, description, canonical, og type=website
- `BreadcrumbJsonLd`: 홈 → 카테고리 세그먼트들

---

## Layout

```
Breadcrumb (fos-blog > categories > ... > current)
CategoryDetailSubHero (eyebrow + h1 + sublines, tinted)
README 섹션 (있을 때만, ReadmeFrame wrap)
01. 하위 폴더 grid (있을 때만, SubfolderCard)
02. 이 폴더의 글 (있을 때만, PostListRow)
```

---

## Related Files

- `src/app/category/[...path]/page.tsx`
- `src/components/Breadcrumb.tsx`
- `src/components/CategoryDetailSubHero.tsx`
- `src/components/CategoriesSection.tsx`
- `src/components/ReadmeFrame.tsx`
- `src/components/SubfolderCard.tsx`
- `src/components/PostListRow.tsx`
- `src/components/MarkdownRenderer.tsx`
- `src/components/JsonLd.tsx`
- `src/lib/subline.ts` — `SublinePart` 공유 타입
- `src/lib/time.ts` — `formatYYYYMMDD`, `formatRelativeKo`
- `src/lib/category-meta.ts` — `getCategoryColor`, `toCanonicalCategory`
- `src/infra/db/repositories/FolderRepository.ts`
- `src/infra/db/constants.ts` — `categoryIcons`, `DEFAULT_CATEGORY_ICON`
- `src/lib/path-utils.ts` — `computeFolderPaths`
- `src/app/globals.css` — `.post-list-row:hover`, `.readme-body code`
