# 글 상세 — Page PRD

**Route:** `/posts/[...slug]`  
**File:** `src/app/posts/[...slug]/page.tsx`  
**Updated:** 2026-04-27

---

## Purpose

마크다운 글의 상세 내용을 렌더링하는 페이지. Round 2 mockup (plan011) 기반의 ArticleHero (mesh + breadcrumb + 카테고리 art-tag + 제목 + 리드 + 메타) + 3-col body grid + sticky TOC + Header 통합 reading progress + mockup 톤 prose 로 구성.

---

## Data

| Source | Method | Returns |
|--------|--------|---------|
| PostRepository | `getPost(slug)` | `{ content: string, post: PostData }` |
| VisitRepository | `getVisitCount(post.path)` | `number` (조회수 — server-side) |

`slug` = URL 세그먼트 배열을 `join("/")` (decodeURIComponent 처리)

**ISR:** `revalidate = 60`  
**Static params:** `generateStaticParams()` — `post.getAllPostPaths()` 로 생성  
**Repositories accessor:** `getRepositories()` (React `cache(...)` wrapper) — 동일 요청 내 재사용

**에러 처리:**
- DB 에러 시 `notFound()`
- `data === null` 시 `notFound()`
- `getVisitCount` 는 `VisitRepository` 내부 try/catch 로 0 fallback (page 레이어 오염 없음)

---

## Components

| Component | Role |
|-----------|------|
| `ArticleHero` | Hero 영역 — mesh 그라디언트 (카테고리 hue 변형 + plan009 토큰) + breadcrumb + 카테고리 art-tag + 제목 + 리드 + meta row (date · readtime · views) |
| `MarkdownRenderer` | 마크다운 본문 렌더링 (GFM, mermaid, syntax highlight). 외부 wrapper 는 `<div>` (글 페이지에서 article 중첩 회피) |
| `TableOfContents` | 사이드바 목차. mono 톤 + 번호 prefix (`01`/`02`) + brand 좌측 라인 + active highlight + sticky top-20. **H2 만 표시** (page.tsx 에서 `level === 2` filter) |
| `ArticleFooter` | `frontmatter.tags` 가 있는 경우만 렌더되는 태그 칩 영역 (graceful fallback) |
| `Comments` | 댓글 섹션 (postPath 전달) |
| `ArticleJsonLd` | JSON-LD 아티클 구조화 데이터 |
| `BreadcrumbJsonLd` | JSON-LD 브레드크럼 |

> Header (`src/components/Header.tsx`) 는 글 페이지 컴포넌트는 아니지만, `/posts/*` pathname 한정으로 하단 1px 라인을 reading progress fill 로 변환 (plan011).

---

## Interactions

- **breadcrumb 항목 클릭**: `/` (홈), `/category/<category>` (카테고리)
- **카테고리 art-tag 자체는 표시용** (현재 링크 아님 — 후속 PR 에서 결정)
- **목차 항목 클릭**: 해당 헤딩으로 스크롤 (`#slug` 앵커)
- **태그 칩**: 표시용 (라우팅은 issue #72 에서 결정 예정)
- **스크롤**: Header 하단 reading progress fill 이 `/posts/*` 에서만 동작

---

## Client State

| State | Component | Description |
|-------|-----------|-------------|
| `activeSlug` | `TableOfContents` | IntersectionObserver 로 현재 뷰포트 내 헤딩 추적 (ADR-006) |
| `progress` | `Header` | `/posts/*` 한정 scroll position → 0~1 ratio. passive listener, `isArticle === false` 일 때 등록 안 함 |

> TOC 의 collapse toggle (`isCollapsed`) 은 plan011 에서 제거됨 — H2 만 필터링해 항목 수가 적고 sticky 사이드바에 항상 노출되어 collapse 가 불필요.

---

## SEO

- `generateMetadata()`: title, description, canonical, og(article), twitter(summary_large_image), publishedTime, modifiedTime
- `ArticleJsonLd`: url, title, description, datePublished, dateModified, authorName/Url
- `BreadcrumbJsonLd`: 홈 → 카테고리 → (서브카테고리) → 글 제목
- Canonical: `${siteUrl}/posts/${slug}`

---

## Layout

```
┌────────────────────────────────────────────────────────┐
│ <ArticleHero> (full-width, header semantic)            │
│   mesh + breadcrumb + art-tag + title + lead + meta    │
└────────────────────────────────────────────────────────┘
┌──────────┬────────────────────────────┬───────────────┐
│ (gutter) │ <div class="prose">        │ <aside>       │
│  1fr     │   MarkdownRenderer (div)   │ TableOfContents│
│          │   minmax(0, 820px)         │ 240px sticky  │
└──────────┴────────────────────────────┴───────────────┘
┌────────────────────────────────────────────────────────┐
│ <ArticleFooter> (tags 있을 때만)                        │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│ <Comments>                                              │
└────────────────────────────────────────────────────────┘
```

- 데스크톱 grid: `1fr | minmax(0, 820px) | 240px` (Q16 — 한글 가독성)
- 모바일 (`md:` 미만): 단일 컬럼 + TOC 숨김 + Hero 단순화 (Q14)

---

## Server-side Processing

`lib/markdown.ts` 함수들이 서버에서 실행됨:
- `parseFrontMatter(content)` — frontmatter 제거 + `frontMatter.tags` 추출
- `stripLeadingH1(mainContent)` — 본문 첫 H1 제거 (ADR-010, 제목 중복 방지)
- `extractTitle(content)` — h1 헤딩 추출
- `extractDescription(content)` — 첫 단락 추출 → ArticleHero `lead`
- `getReadingTime(content)` — 읽기 시간 계산 → ArticleHero meta row
- `generateTableOfContents(stripped)` — TOC 항목 생성. page.tsx 에서 `filter((i) => i.level === 2)` 로 H2 만 추림

---

## Related Files

- `src/app/posts/[...slug]/page.tsx`
- `src/components/ArticleHero.tsx`
- `src/components/ArticleFooter.tsx`
- `src/components/MarkdownRenderer.tsx`
- `src/components/TableOfContents.tsx`
- `src/components/Header.tsx` — `/posts/*` reading progress
- `src/components/Comments.tsx`
- `src/components/JsonLd.tsx`
- `src/infra/db/repositories/PostRepository.ts`
- `src/infra/db/repositories/VisitRepository.ts` — `getVisitCount(pagePath)`
- `src/lib/markdown.ts`
- `src/lib/category-meta.ts` — `getCategoryColor` / `getCategoryHue` / `toCanonicalCategory` (plan010)
- `src/app/globals.css` — plan009 토큰 + plan011 prose 확장 (H2 counter / blockquote QUOTE / inline code / mermaid 격리)

---

## Constraints

- `TableOfContents` 는 `tocItems.length > 0` 일 때만 렌더 (level===2 filter 후 0이면 사이드바 빈 칸 회피)
- GitHub 원본 링크는 plan011 단계에서 글 페이지에서 제거 (Hero 가 메타 흡수). 후속 PR 에서 footer 또는 별도 메뉴로 복원 검토
- 모바일에서 TOC 미노출 — 별도 모바일 TOC 구현 시 이 문서 업데이트 필요
- **조회수 증가**는 `src/proxy.ts` Node Runtime middleware (실 동작은 `src/middleware/visit.ts`) 에서 upsert. **표시**는 page.tsx 가 server-side `getVisitCount(post.path)` 로 fetch 하여 `<ArticleHero viewCount={…}/>` 에 전달 (plan011 이전의 client `<PostViewCount>` 패턴은 폐기)
- prose 의 H2 CSS counter 는 `.prose` 단일 셀렉터에서 reset 되므로, 페이지 내 prose 컨테이너는 1개로 유지해야 번호가 어긋나지 않음
