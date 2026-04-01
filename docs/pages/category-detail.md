# 카테고리/폴더 상세 — Page PRD

**Route:** `/category/[...path]`  
**File:** `src/app/category/[...path]/page.tsx`  
**Updated:** 2026-04-02

---

## Purpose

특정 카테고리 또는 하위 폴더의 내용을 보여주는 페이지. 하위 폴더 목록, 해당 폴더의 글 목록, README.md(있으면) 를 표시한다. 다단계 중첩 경로를 지원한다.

---

## Data

| Source | Method | Returns |
|--------|--------|---------|
| FolderRepository | `getFolderContents(folderPath)` | `{ folders, posts, readme }` |
| VisitRepository | `getPostVisitCounts(postPaths)` | 글 조회수 맵 |

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
| `PostCard` | 글 목록 카드 (showCategory=false) |
| `MarkdownRenderer` | README.md 렌더링 (있을 때만) |
| `BreadcrumbJsonLd` | JSON-LD 브레드크럼 |

---

## Interactions

- **"상위 폴더로" / "카테고리 목록으로"**: 상위 경로 또는 `/categories` 이동
- **브레드크럼 링크**: 경로 중간 세그먼트로 이동
- **하위 폴더 카드 클릭**: `/category/<folder.path>` 이동
- **PostCard 클릭**: `/posts/<post.path>` 이동

---

## SEO

- `generateMetadata()`: title=currentFolder, description, canonical, og type=website
- `BreadcrumbJsonLd`: 홈 → 카테고리 세그먼트들

---

## Layout

```
← 상위 폴더로 / ← 카테고리 목록으로
브레드크럼 네비게이션 (Home > ... > currentFolder)
헤더 (카테고리 아이콘 + 폴더명 + 폴더/글 수)
README.md 섹션 (있을 때만)
하위 폴더 그리드 (있을 때만)
이 폴더의 글 목록 (있을 때만)
```

---

## Related Files

- `src/app/category/[...path]/page.tsx`
- `src/components/PostCard.tsx`
- `src/components/MarkdownRenderer.tsx`
- `src/components/JsonLd.tsx`
- `src/infra/db/repositories/FolderRepository.ts`
- `src/infra/db/repositories/VisitRepository.ts`
- `src/infra/db/constants.ts` — `categoryIcons`, `DEFAULT_CATEGORY_ICON`
- `src/lib/path-utils.ts` — `computeFolderPaths`
