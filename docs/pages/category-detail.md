# 카테고리/폴더 상세 — Page PRD

**Route:** `/category/[...path]`  
**File:** `src/app/category/[...path]/page.tsx`  
**Updated:** 2026-07-01

---

## Purpose

특정 카테고리 또는 하위 폴더의 내용을 보여주는 페이지. tinted sub-hero (좌 2px cat-color + 5% gradient), README frame, 하위 폴더 카드, post list row 를 표시한다. 다단계 중첩 경로를 지원한다. plan015 기반 리디자인.

---

## Data

| Source | Method | Returns |
|--------|--------|---------|
| FolderRepository | `getFolderContents(folderPath)` | `{ folders, posts, readme }` |
| PostRepository | `getCrossCategoryPosts(folderPath)` | 현재 폴더 경로를 frontmatter `categories` 에 포함하지만 경로상 해당 폴더 밖에 있는 cross-post 글 |

`folderPath` = `pathSegments.join("/")`  
`pathSegments` = URL 세그먼트 배열 (decodeURIComponent 처리)

frontmatter `categories` 는 `AI` 같은 최상위 폴더뿐 아니라 `AI/RAG` 같은 하위 폴더 경로도 허용한다.
페이지는 `getFolderContents(folderPath)` 결과와 `getCrossCategoryPosts(folderPath)` 결과를 path 기준으로 중복 제거해 합친다.
색상과 아이콘은 slash path의 첫 세그먼트 기준으로 fallback한다.

**ISR:** `revalidate = 60`  
**Static params:** `generateStaticParams()` — `computeFolderPaths(post.getAllPostPaths())` 로 생성

**에러 처리:**
- DB 에러 시 빈 폴더 컨텐츠로 폴백
- `folders`, merged posts, `readme` 모두 없으면 `notFound()`

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
02. 이 폴더의 글 (폴더 직속 글 + cross-post 글이 있을 때만, PostListRow)
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
- `src/infra/db/repositories/PostRepository.ts` — `getCrossCategoryPosts`
- `src/infra/db/constants.ts` — `categoryIcons`, `DEFAULT_CATEGORY_ICON`
- `src/lib/path-utils.ts` — `computeFolderPaths`
- `src/app/globals.css` — `.post-list-row:hover`, `.readme-body code`
