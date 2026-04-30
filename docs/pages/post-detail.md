# 글 상세 — Page PRD

**Route:** `/posts/[...slug]`  
**File:** `src/app/posts/[...slug]/page.tsx`  
**Updated:** 2026-04-30

---

## Purpose

마크다운 글의 상세 내용을 렌더링하는 페이지. Round 2 mockup (plan011) 기반의 ArticleHero (mesh + breadcrumb + 카테고리 art-tag + 제목 + 리드 + 메타) + 3-col body grid + sticky TOC (H2/H3 nesting) + Header 통합 reading progress + viewport 최상단 독립 `ReadingProgressBar` (plan019) + 모바일 floating TOC button (plan019) + mockup 톤 prose 로 구성.

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
| `MarkdownRenderer` | 마크다운 본문 렌더링 (GFM, mermaid, syntax highlight via rehype-pretty-code + shiki dual theme). 외부 wrapper 는 `<div>` (글 페이지에서 article 중첩 회피). `components.figure` 핸들러가 pretty-code 의 figure 를 받아 `<CodeCard>` 로 교체. mermaid 는 `data-language === "mermaid"` 검사로 우회 (`<Mermaid>` 직접 반환) |
| `CodeCard` | rehype-pretty-code 가 생성한 figure 코드 블록을 받아 frame (filename header / 언어 배지 / copy 버튼) 으로 wrap 하는 client component. shadcn Button (variant=ghost size=xs) + clipboard API + 2초 idle 복귀 + `aria-live="polite"` 스크린리더 통지 (plan012) |
| `TableOfContents` | 사이드바 목차. mono 톤 + 번호 prefix (`01`/`02`, H2 카운터) + brand 좌측 라인 + active highlight + sticky top-20. **H2 + H3 표시** (page.tsx 에서 `level === 2 \|\| level === 3` filter, plan019). H3 는 `pl-6` 들여쓰기 + `text-[11px]` + 번호 미표시 nested 표현 |
| `ReadingProgressBar` | viewport 최상단 fixed 1px 진행 띠 (`z-50`, plan019). passive scroll/resize listener → 0~100 % width. brand-400 토큰 색상. `role="progressbar"` + `aria-valuenow` 접근성 메타. Header 의 하단 라인 reading progress 와 별개로 viewport 절대 최상단에서 동작 |
| `MobileTocButton` | 모바일 전용 floating TOC FAB + bottom sheet (plan019, `md:hidden`). 우하단 원형 brand 버튼 (lucide `List`) → 클릭 시 fixed bottom sheet (`role="dialog" aria-modal="true"`) 펼침. ESC keydown / backdrop click 으로 닫기 (둘 다 useEffect cleanup 에서 listener 해제). 단순 fixed div + state — `<dialog>` element 미사용 (SSR hydration mismatch 회피 의도). H2/H3 nesting 동일 적용. `toc.length === 0` 시 자체 미렌더 |
| `ArticleFooter` | `frontmatter.tags` 가 있는 경우만 렌더되는 태그 칩 영역 (graceful fallback) |
| `Comments` | 댓글 섹션 (postPath 전달) |
| `ArticleJsonLd` | JSON-LD 아티클 구조화 데이터 |
| `BreadcrumbJsonLd` | JSON-LD 브레드크럼 |

> Header (`src/components/Header.tsx`) 는 글 페이지 컴포넌트는 아니지만, `/posts/*` pathname 한정으로 하단 1px 라인을 reading progress fill 로 변환 (plan011).

---

## Interactions

- **breadcrumb 항목 클릭**: `/` (홈), `/category/<category>` (카테고리)
- **카테고리 art-tag 자체는 표시용** (현재 링크 아님 — 후속 PR 에서 결정)
- **목차 항목 클릭**: 해당 헤딩으로 스크롤 (`#slug` 앵커). 모바일에서는 `MobileTocButton` bottom sheet 가 함께 닫힘
- **태그 칩**: 표시용 (라우팅은 issue #72 에서 결정 예정)
- **스크롤**: ① Header 하단 reading progress fill 이 `/posts/*` 에서만 동작 ② viewport 최상단 `ReadingProgressBar` 가 모든 디바이스에서 0~100 % width 로 진행률 표시 (plan019, 둘은 독립)
- **모바일 TOC**: 우하단 FAB 클릭 → bottom sheet (max-h 70vh, scroll). ESC / 백드롭 클릭으로 닫힘 (plan019)

---

## Client State

| State | Component | Description |
|-------|-----------|-------------|
| `activeSlug` | `TableOfContents` / `MobileTocButton` | IntersectionObserver 로 현재 뷰포트 내 헤딩 추적 (ADR-006). H2/H3 모두 적용 |
| `progress` (Header) | `Header` | `/posts/*` 한정 scroll position → 0~1 ratio. passive listener, `isArticle === false` 일 때 등록 안 함 |
| `progress` (Bar) | `ReadingProgressBar` | viewport 절대 최상단 1px 띠. scroll/resize passive listener 양쪽 cleanup, 0~100 % width (plan019). Header progress 와 독립 |
| `open` | `MobileTocButton` | bottom sheet 펼침 상태. open 인 동안에만 keydown(ESC) listener 등록 → cleanup 에서 해제 (plan019) |

> TOC 의 collapse toggle (`isCollapsed`) 은 plan011 에서 제거됨 — sticky 사이드바에 항상 노출되어 collapse 가 불필요. plan019 에서 H3 nesting 추가 후에도 유지 (H3 들여쓰기 + 작은 글씨로 노이즈 최소화).

---

## SEO

- `generateMetadata()`: title, description, canonical, og(article), twitter(summary_large_image), publishedTime, modifiedTime
- `ArticleJsonLd`: url, title, description, datePublished, dateModified, authorName/Url
- `BreadcrumbJsonLd`: 홈 → 카테고리 → (서브카테고리) → 글 제목
- Canonical: `${siteUrl}/posts/${slug}`

---

## Layout

```
══════════════════════════════════════════════════════════  ← <ReadingProgressBar/> (fixed top, z-50, 1px, plan019)
┌────────────────────────────────────────────────────────┐
│ <ArticleHero> (full-width, header semantic)            │
│   mesh + breadcrumb + art-tag + title + lead + meta    │
└────────────────────────────────────────────────────────┘
┌──────────┬────────────────────────────┬───────────────┐
│ (gutter) │ <div class="prose">        │ <aside>       │
│  1fr     │   MarkdownRenderer (div)   │ TableOfContents│
│          │   minmax(0, 820px)         │ 240px sticky  │
└──────────┴────────────────────────────┴───────────────┘
                                            ┌──┐  ← <MobileTocButton/> (md:hidden, bottom-6 right-6, plan019)
                                            │ ≣│
                                            └──┘
┌────────────────────────────────────────────────────────┐
│ <ArticleFooter> (tags 있을 때만)                        │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│ <Comments>                                              │
└────────────────────────────────────────────────────────┘
```

- 데스크톱 grid: `1fr | minmax(0, 820px) | 240px` (Q16 — 한글 가독성)
- 모바일 (`md:` 미만): 단일 컬럼 + 사이드 TOC 숨김 + 우하단 `MobileTocButton` FAB (plan019) + Hero 단순화 (Q14)

---

## Server-side Processing

`lib/markdown.ts` 함수들이 서버에서 실행됨:
- `parseFrontMatter(content)` — frontmatter 제거 + `frontMatter.tags` 추출
- `stripLeadingH1(mainContent)` — 본문 첫 H1 제거 (ADR-010, 제목 중복 방지)
- `extractTitle(content)` — h1 헤딩 추출
- `extractDescription(content)` — 첫 단락 추출 → ArticleHero `lead`
- `getReadingTime(content)` — 읽기 시간 계산 → ArticleHero meta row
- `generateTableOfContents(stripped)` — TOC 항목 생성. page.tsx 에서 `filter((i) => i.level === 2 || i.level === 3)` 로 H2 + H3 추림 (plan019)

---

## Related Files

- `src/app/posts/[...slug]/page.tsx`
- `src/components/ArticleHero.tsx`
- `src/components/ArticleFooter.tsx`
- `src/components/MarkdownRenderer.tsx`
- `src/components/CodeCard.tsx` — 코드 블록 frame wrapper (plan012)
- `src/components/TableOfContents.tsx` — H2 numbered + H3 nested (plan019)
- `src/components/ReadingProgressBar.tsx` — viewport 최상단 1px 진행 띠 (plan019)
- `src/components/MobileTocButton.tsx` — 모바일 floating TOC button + bottom sheet (plan019)
- `src/components/Header.tsx` — `/posts/*` 한정 하단 라인 reading progress (별개 컴포넌트)
- `src/components/Comments.tsx`
- `src/components/JsonLd.tsx`
- `src/infra/db/repositories/PostRepository.ts`
- `src/infra/db/repositories/VisitRepository.ts` — `getVisitCount(pagePath)`
- `src/lib/markdown.ts` — 본문 처리 + plan012 hast 헬퍼 (`extractRawText` / `findChildText` / `findCodeProp`)
- `src/lib/category-meta.ts` — `getCategoryColor` / `getCategoryHue` / `toCanonicalCategory` (plan010)
- `src/app/globals.css` — plan009 토큰 + plan011 prose 확장 (H2 counter / blockquote QUOTE / inline code / mermaid 격리) + plan012 코드 블록 frame (`.code-card` / shiki dual theme)

---

## Constraints

- `TableOfContents` 는 `tocItems.length > 0` 일 때만 렌더 (`level === 2 || level === 3` filter 후 0이면 사이드바 빈 칸 회피). `MobileTocButton` 도 동일 정책으로 자체 미렌더
- GitHub 원본 링크는 plan011 단계에서 글 페이지에서 제거 (Hero 가 메타 흡수). 후속 PR 에서 footer 또는 별도 메뉴로 복원 검토
- 모바일 (`md:` 미만) 은 plan019 의 `MobileTocButton` (FAB + bottom sheet) 으로 TOC 접근. 사이드 sticky TOC 는 여전히 미노출
- `ReadingProgressBar` 는 신규 토큰 추가 없이 plan009 토큰 (`--color-brand-400`) 만 사용. `<dialog>` element 가 아닌 `role="dialog"` div 채택 이유는 SSR hydration mismatch 회피 + bottom sheet 애니메이션/배경 처리 자유도 확보 (plan019 risks 표 참조)
- **조회수 증가**는 `src/proxy.ts` Node Runtime middleware (실 동작은 `src/middleware/visit.ts`) 에서 upsert. **표시**는 page.tsx 가 server-side `getVisitCount(post.path)` 로 fetch 하여 `<ArticleHero viewCount={…}/>` 에 전달 (plan011 이전의 client `<PostViewCount>` 패턴은 폐기)
- prose 의 H2 CSS counter 는 `.prose` 단일 셀렉터에서 reset 되므로, 페이지 내 prose 컨테이너는 1개로 유지해야 번호가 어긋나지 않음
