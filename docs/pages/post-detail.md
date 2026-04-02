# 글 상세 — Page PRD

**Route:** `/posts/[...slug]`  
**File:** `src/app/posts/[...slug]/page.tsx`  
**Updated:** 2026-04-02

---

## Purpose

마크다운 글의 상세 내용을 렌더링하는 페이지. 본문, 목차(사이드바), 메타 정보(읽기 시간, 작성일, 수정일, 조회수), 댓글을 제공한다.

---

## Data

| Source | Method | Returns |
|--------|--------|---------|
| PostRepository | `getPost(slug)` | `{ content: string, post: PostData }` |

`slug` = URL 세그먼트 배열을 `join("/")` (decodeURIComponent 처리)

**ISR:** `revalidate = 60`  
**Static params:** `generateStaticParams()` — `post.getAllPostPaths()` 로 생성

**에러 처리:**
- DB 에러 시 `notFound()`
- `data === null` 시 `notFound()`

---

## Components

| Component | Role |
|-----------|------|
| `MarkdownRenderer` | 마크다운 본문 렌더링 (GFM, mermaid, syntax highlight) |
| `TableOfContents` | 사이드바 목차 (lg 이상에서만 표시, `hidden lg:block`) |
| `Comments` | 댓글 섹션 (postSlug 전달) |
| `PostViewCount` | 조회수 표시 (클라이언트에서 `/api/visit?path=...` GET으로 fetch) |
| `ArticleJsonLd` | JSON-LD 아티클 구조화 데이터 |
| `BreadcrumbJsonLd` | JSON-LD 브레드크럼 |

---

## Interactions

- **카테고리 배지 클릭**: `/category/<category>` 이동
- **목차 항목 클릭**: 해당 헤딩으로 스크롤 (`#slug` 앵커)
- **"GitHub에서 보기" 링크**: GitHub 원본 파일 새 탭 오픈
- **"수정 제안하기" 버튼**: GitHub 원본 파일 새 탭 오픈
- **"카테고리의 다른 글 보기"**: `/category/<category>` 이동

---

## Client State

| State | Component | Description |
|-------|-----------|-------------|
| `activeSlug` | `TableOfContents` | IntersectionObserver로 현재 뷰포트 내 헤딩 추적 |
| `isCollapsed` | `TableOfContents` | 목차 접기/펼치기 상태 (localStorage 유지) |

---

## SEO

- `generateMetadata()`: title, description, canonical, og(article), twitter(summary_large_image), publishedTime, modifiedTime
- `ArticleJsonLd`: url, title, description, datePublished, dateModified, authorName/Url
- `BreadcrumbJsonLd`: 홈 → 카테고리 → (서브카테고리) → 글 제목
- Canonical: `${siteUrl}/posts/${slug}`

---

## Layout

```
← 목록으로 돌아가기
┌─────────────────────────────┬──────────────┐
│ <article>                   │ <aside>      │
│   헤더 (카테고리, 제목,     │ TableOfContents│
│         메타, 조회수)       │ (lg:block)   │
│   MarkdownRenderer           │              │
│   푸터 (카테고리링크, GitHub)│              │
│   Comments                  │              │
└─────────────────────────────┴──────────────┘
```

모바일: aside 숨김 (`hidden lg:block`), TOC 미노출

---

## Server-side Processing

`lib/markdown.ts` 함수들이 서버에서 실행됨:
- `parseFrontMatter(content)` — frontmatter 제거
- `extractTitle(content)` — h1 헤딩 추출
- `extractDescription(content)` — 첫 단락 추출
- `getReadingTime(content)` — 읽기 시간 계산
- `generateTableOfContents(mainContent)` — TOC 항목 생성

---

## Related Files

- `src/app/posts/[...slug]/page.tsx`
- `src/components/MarkdownRenderer.tsx`
- `src/components/TableOfContents.tsx`
- `src/components/Comments.tsx`
- `src/components/PostViewCount.tsx`
- `src/components/JsonLd.tsx`
- `src/infra/db/repositories/PostRepository.ts`
- `src/lib/markdown.ts`
- `src/infra/db/constants.ts` — `categoryIcons`

---

## Constraints

- `TableOfContents`는 `toc.length > 0` 일 때만 렌더링
- GitHub URL은 `jon890/fos-study` 레포 고정
- 모바일에서 TOC 미노출 — 별도 모바일 TOC 구현 시 이 문서 업데이트 필요
- **조회수 증가**는 `src/proxy.ts`(Edge middleware)에서 처리 — `PostViewCount`는 표시만 담당
