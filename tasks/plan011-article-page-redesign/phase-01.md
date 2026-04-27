# Phase 01 — ArticleHero + 3-col body + TOC 리디자인 + Header reading progress + prose 토큰

## 컨텍스트 (자기완결 프롬프트)

plan009 (design tokens) + plan010 (category-meta) 머지 완료 전제. Claude Design Round 2 mockup 의 `Artwork` 컴포넌트 (`/tmp/components-1.jsx` 의 `Artwork` 함수 + `/tmp/components.css` 의 `.art-*` 섹션) 를 fos-blog 글 상세 페이지에 적용. **명백한 시각 변화** — Hero 신설 + 3-col body grid + sticky TOC mono 톤 + Header 의 1px 하단 라인을 reading progress fill 로 변환 + prose 마크업 mockup 톤.

scope 외 (별도 이슈로 분리됨):
- series 메타 + footer 태그 리스트 + prev/next 글 navigation → **issue #72**
- Comments.tsx 디자인 토큰 적용 → **issue #73**
- fenced code block 의 filename header / line numbers / copy / variants → **plan012** (별도)

### 현재 baseline (변경 대상)

`src/app/posts/[...slug]/page.tsx` (273 라인):
- 서버 컴포넌트, `getRepositories().post.getPost(slug)` → `data` (post + content)
- `extractTitle / extractDescription / getReadingTime / generateTableOfContents / parseFrontMatter / stripLeadingH1` 모두 `@/lib/markdown` 에서 import 중 — **재사용 가능**
- 하단에 `<MarkdownRenderer content={stripped} /> + <TableOfContents items={…} /> + <Comments /> + <PostViewCount />` 렌더
- `revalidate = 60` (ISR)

`src/components/TableOfContents.tsx`:
- 이미 client 컴포넌트, IntersectionObserver active section 추적
- `items: TocItem[]` props (level/text/slug)
- mockup 톤으로 **in-place 리디자인** (Q11 A)

`src/components/Header.tsx`:
- 이미 client 컴포넌트 가능성 — 확인 후 **하단 1px 라인을 reading progress fill 로 변환** (Q6 A)
- `usePathname()` 으로 `/posts/...` 에서만 scroll listener 활성

`src/components/MarkdownRenderer.tsx`:
- react-markdown + remark-gfm + rehype-slug + rehype-highlight + mermaid
- 이번 phase 에선 **prose className 만 새 토큰으로 정렬** (Q12 A — typography 플러그인 보존)

`src/app/globals.css` (plan009 후):
- `--mesh-stop-01~06`, `--color-cat-*`, `--color-fg-*`, `--color-border-*`, `--font-mono` 토큰 모두 정의됨
- `.prose pre/code/blockquote` 룰 존재 — mockup 톤으로 확장 (이번 phase)

`src/lib/markdown.ts`:
- `generateTableOfContents(content): TocItem[]` — H1~H6 모두 반환 → **filter level === 2** 로 H2 만 추출 (mockup 패턴)
- `getReadingTime(content): number` — 200 wpm 추정. **Hero meta 에 사용** (Q4 B)

### 이 phase 의 핵심 전환

1. **Hero 신설**: `<ArticleHero>` 컴포넌트 + mesh 그라디언트 (Q21 B — 카테고리 hue 변형) + 카테고리 art-tag + title 52px + lead + breadcrumb (Q19 B — Hero 안 비-sticky) + meta row (date · {readTime} min · {viewCount} views, Q20 A)
2. **3-col body grid**: `1fr | minmax(0, 820px) | 240px(TOC)` (Q16 B — 한글 가독성). 모바일 (md 미만) 단일 col + TOC 숨김 (Q14 A)
3. **TOC in-place 리디자인**: mono font + active highlight + `01`/`02` 번호 prefix + 좌측 border 라인 + sticky top
4. **Header reading progress 통합** (Q6 A): Header 하단 1px 경계선을 progress fill 로 변환. `/posts/...` pathname 에서만 scroll listener 활성 (다른 페이지 영향 0)
5. **prose mockup 톤**: H2 CSS counter (`01`/`02` 번호, Q13 B — 무비용 CSS-only) + blockquote QUOTE 라벨 + inline code 토큰 색 + ul li `—` prefix
6. **mermaid 격리** (Q18 C): `.prose pre.mermaid` selector 로 prose 영향 차단 + 회귀 테스트 통과 확인
7. **graceful fallback**: `frontmatter.tags` 가 있는 글에 한해 footer 에 태그 칩 노출 (Q15 A). 없으면 footer 자체 미렌더 (series 노출은 issue #72 작업에서)

## 먼저 읽을 문서

- `docs/adr.md` — **ADR-017** (디자인 시스템)
- `docs/design-inspiration.md` — Round 2 컴포넌트 mockup 메모
- `src/app/globals.css` — plan009 토큰 (`--mesh-stop-*`, `--color-cat-*`, `--color-fg-*`, `--color-border-*`)
- `src/lib/markdown.ts` — `generateTableOfContents`, `getReadingTime`, `parseFrontMatter`, `stripLeadingH1`
- `src/lib/category-meta.ts` (plan010) — `getCategoryHue(post.category)` 로 mesh 첫 stop 변형
- `.claude/skills/_shared/common-critic-patterns.md` — 시드 7 패턴 self-check

## 사전 게이트

```bash
# cwd: <worktree root>

# 1) plan009 + plan010 머지 완료
grep -n -- "--mesh-stop-01" src/app/globals.css
grep -n -- "--color-cat-system" src/app/globals.css
test -f src/lib/category-meta.ts
grep -n "export function getCategoryHue" src/lib/category-meta.ts

# 2) 기존 컴포넌트 + 유틸 위치
test -f src/app/posts/\[...slug\]/page.tsx
test -f src/components/TableOfContents.tsx
test -f src/components/MarkdownRenderer.tsx
test -f src/components/Header.tsx
grep -n "generateTableOfContents\|getReadingTime\|stripLeadingH1\|parseFrontMatter" src/lib/markdown.ts | wc -l  # >= 4
```

위 항목 중 어느 하나라도 실패하면 **PHASE_BLOCKED: plan009/plan010 선행 필요**.

## Round 2 mockup 추출

```bash
# cwd: <worktree root>
tar xzOf ~/.claude/projects/-Users-nhn-personal-fos-blog/d11b8756-7896-451b-932e-0678c2241d67/tool-results/webfetch-1777098410179-5850mb.bin 'fos-blog/project/components-1.jsx' > /tmp/components-1.jsx
tar xzOf ~/.claude/projects/-Users-nhn-personal-fos-blog/d11b8756-7896-451b-932e-0678c2241d67/tool-results/webfetch-1777098410179-5850mb.bin 'fos-blog/project/components.css' > /tmp/components.css
```

`/tmp/components-1.jsx` 의 `Artwork` 함수 + `/tmp/components.css` 의 `.art-*` (라인 30-235 범위) 가 source of truth. 코드는 그대로 복사 금지 — fos-blog 의 React/Next 패턴으로 재구성.

## 작업 목록 (총 5개)

### 1. `src/components/ArticleHero.tsx` 신규

서버 컴포넌트. mockup 의 `art-hero` 영역. mesh 그라디언트 + breadcrumb + art-tag + title + lead + meta row + (옵션) author 영역은 미사용 (Q2 B — 단일 작성자 자명).

```tsx
import Link from "next/link";
import type { CSSProperties } from "react";
import { getCategoryColor, getCategoryHue, toCanonicalCategory } from "@/lib/category-meta";

interface ArticleHeroProps {
  category: string;            // post.category (raw)
  title: string;
  description: string;         // extractDescription(content)
  createdAt: Date | null;
  readTimeMinutes: number;     // getReadingTime(content)
  viewCount: number;           // PostViewCount 와 같은 데이터 — 서버에서 미리 받음
  breadcrumb: { label: string; href?: string }[];  // [{label:'fos-blog', href:'/'}, {label:'react', href:'/category/react'}, {label:'<truncated title>'}]
}

export function ArticleHero({
  category,
  title,
  description,
  createdAt,
  readTimeMinutes,
  viewCount,
  breadcrumb,
}: ArticleHeroProps) {
  const catColor = getCategoryColor(category);
  const catHue = getCategoryHue(category);
  const canonical = toCanonicalCategory(category);
  const inlineStyle = {
    "--cat-color": catColor,
    "--mesh-stop-cat": `oklch(0.7 0.16 ${catHue})`,
  } as CSSProperties;

  const dateStr = createdAt
    ? `${createdAt.getFullYear()}.${String(createdAt.getMonth() + 1).padStart(2, "0")}.${String(createdAt.getDate()).padStart(2, "0")}`
    : "";

  return (
    <header
      className="relative overflow-hidden border-b border-[var(--color-border-subtle)] px-6 pt-8 pb-12 md:pt-16 md:pb-14"
      style={inlineStyle}
    >
      {/* Mesh gradient — Q21 B: 첫 stop 카테고리 hue */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 blur-[40px] saturate-[140%]"
        style={{
          background:
            "radial-gradient(60% 80% at 20% 20%, var(--mesh-stop-cat) / 0.45, transparent 60%), radial-gradient(50% 70% at 80% 30%, var(--mesh-stop-03) / 0.32, transparent 60%), radial-gradient(50% 70% at 50% 80%, var(--mesh-stop-02) / 0.35, transparent 60%)",
        }}
      />
      {/* 80px grid mask */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          backgroundImage: "linear-gradient(to right, var(--color-border-subtle) 1px, transparent 1px)",
          backgroundSize: "80px 100%",
          maskImage: "linear-gradient(to bottom, transparent, black 30%, black 80%, transparent)",
        }}
      />

      <div className="relative z-[2] mx-auto max-w-[880px]">
        {/* Breadcrumb (Q19 B) */}
        <nav
          aria-label="breadcrumb"
          className="mb-6 flex items-center gap-2 font-mono text-[12px] text-[var(--color-fg-muted)]"
        >
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-[var(--color-fg-faint)]">/</span>}
              {item.href ? (
                <Link href={item.href} className="hover:text-[var(--color-fg-primary)]">
                  {item.label}
                </Link>
              ) : (
                <span className="text-[var(--color-fg-primary)]">{item.label}</span>
              )}
            </span>
          ))}
        </nav>

        {/* Category art-tag */}
        <span
          className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em]"
          style={{
            color: "var(--cat-color)",
            borderColor: "var(--cat-color)",
            background: "color-mix(in oklch, var(--cat-color), transparent 90%)",
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          {canonical}
        </span>

        <h1 className="mt-6 mb-5 max-w-[22ch] text-[34px] font-semibold leading-[1.1] tracking-tight text-[var(--color-fg-primary)] md:text-[52px]">
          {title}
        </h1>

        {description && (
          <p className="mb-4 max-w-[56ch] text-[16px] leading-relaxed text-[var(--color-fg-secondary)] md:text-[18px]">
            {description}
          </p>
        )}

        {/* Meta row — Q20 A: date · readtime · views */}
        <div className="mt-6 flex flex-wrap items-center gap-3 font-mono text-[12px] text-[var(--color-fg-muted)]">
          {dateStr && <span>{dateStr}</span>}
          {dateStr && <span className="text-[var(--color-fg-faint)]">·</span>}
          <span>{readTimeMinutes} min read</span>
          <span className="text-[var(--color-fg-faint)]">·</span>
          <span>{viewCount.toLocaleString()} views</span>
        </div>
      </div>
    </header>
  );
}
```

설계 메모:
- `--mesh-stop-cat` inline 변수로 카테고리별 첫 stop 변형 (Q21 B)
- 두 번째/세 번째 stop 은 토큰 `--mesh-stop-03` (violet), `--mesh-stop-02` (cyan) 그대로 — 안정감 유지
- breadcrumb 의 마지막 항목 (글 제목) 은 truncate 처리는 page.tsx 에서 (`title.slice(0, 24) + "…"` 또는 CSS truncate)
- `aria-hidden` 으로 mesh/grid 레이어 스크린리더 차단

### 2. `src/components/ArticleFooter.tsx` 신규

graceful fallback 으로 `frontmatter.tags` 있는 경우만 렌더 (Q15 A).

```tsx
interface ArticleFooterProps {
  tags?: string[];  // frontmatter.tags 결과, 없거나 0개면 미렌더
}

export function ArticleFooter({ tags }: ArticleFooterProps) {
  if (!tags || tags.length === 0) return null;

  return (
    <footer className="mx-auto mt-16 max-w-[880px] border-t border-[var(--color-border-subtle)] px-6 py-12">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
        tags
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded border border-[var(--color-border-subtle)] px-2.5 py-1 font-mono text-[11px] tracking-tight text-[var(--color-fg-secondary)]"
          >
            #{tag}
          </span>
        ))}
      </div>
    </footer>
  );
}
```

### 3. `src/components/TableOfContents.tsx` in-place 리디자인 (Q11 A)

기존 컴포넌트의 className 만 mockup 톤으로 교체. props/state 시그니처 유지. mockup `.toc-list` 패턴 적용.

핵심 변경:
- Container: `font-mono text-[12px]`
- Header `on this page` (mono uppercase tracking-[0.1em] + 좌측 brand 8px 라인)
- 각 항목: `border-l border-[var(--color-border-subtle)] pl-3 py-1`, hover 시 `text-[var(--color-fg-primary)] border-[var(--color-border-strong)]`, active 시 `text-[var(--color-brand-400)] border-[var(--color-brand-400)] font-medium`
- 번호 prefix: `<span className="text-[var(--color-fg-faint)] mr-1">{String(idx + 1).padStart(2, "0")}</span>`
- **filter level === 2** 만 표시 (mockup 패턴, H3 제외)
- sticky top-20 (Header 높이 + 여유)

### 4. `src/components/Header.tsx` reading progress 통합 (Q6 A)

Header 가 이미 client component 인지 확인. 아니면 client 전환 (`"use client"` 추가).

추가:
```tsx
"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
// ...

const pathname = usePathname();
const isArticle = pathname?.startsWith("/posts/");
const [progress, setProgress] = useState(0);

useEffect(() => {
  if (!isArticle) {
    setProgress(0);
    return;
  }
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}, [isArticle]);
```

JSX (Header 의 sticky 컨테이너 끝부분):
```tsx
{/* 기존 border-b 또는 box-shadow 를 progress fill 로 대체 */}
<div className="relative">
  {/* ... 기존 Header 내용 ... */}
  <div
    aria-hidden
    className="absolute bottom-0 left-0 h-px w-full bg-[var(--color-border-subtle)]"
  />
  {isArticle && (
    <div
      aria-hidden
      className="absolute bottom-0 left-0 h-px bg-[var(--color-brand-400)] transition-[width] duration-75 ease-linear"
      style={{ width: `${progress * 100}%`, boxShadow: "0 0 8px var(--color-brand-400)" }}
    />
  )}
</div>
```

설계 메모:
- 다른 페이지에선 progress fill 미렌더 (`isArticle === false`) — 기존 1px border 그대로
- scroll listener 는 `isArticle` 조건에서만 등록 → 메모리 누수 없음
- transition 75ms (mockup 의 `--duration-instant`) — 스크롤 따라 빠르게 반응

### 5. `page.tsx` + `MarkdownRenderer.tsx` + `globals.css` 통합

#### 5a. `src/app/posts/[...slug]/page.tsx` 재구성

기존 layout 을 `ArticleHero` + 3-col grid + `MarkdownRenderer` + `TableOfContents` (filter H2) + `ArticleFooter` + 기존 `Comments` + `JsonLd` 로 교체.

주요 변경:
```tsx
const tocItems = generateTableOfContents(stripped).filter((i) => i.level === 2);
const readTime = getReadingTime(stripped);
const viewCount = data.post.visitCount ?? 0;
const desc = extractDescription(data.content);
const breadcrumb = [
  { label: "fos-blog", href: "/" },
  { label: post.category, href: `/category/${encodeURIComponent(post.category)}` },
  { label: title.length > 24 ? `${title.slice(0, 24)}…` : title },
];

return (
  <>
    <ArticleJsonLd … />
    <BreadcrumbJsonLd … />
    <ArticleHero
      category={post.category}
      title={title}
      description={desc}
      createdAt={post.createdAt}
      readTimeMinutes={readTime}
      viewCount={viewCount}
      breadcrumb={breadcrumb}
    />
    <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-6 py-12 md:grid-cols-[1fr_minmax(0,820px)_240px] md:gap-12 md:py-16">
      <div className="hidden md:block" aria-hidden />
      <article className="prose prose-fos min-w-0">
        <MarkdownRenderer content={stripped} />
      </article>
      <aside className="hidden md:block">
        <TableOfContents items={tocItems} />
      </aside>
    </div>
    <ArticleFooter tags={frontMatter.tags} />
    <div className="mx-auto max-w-[880px] px-6 pb-12">
      <Comments postPath={post.path} />
    </div>
  </>
);
```

기존 `<Folder>`, `<Calendar>`, `<Clock>` lucide 아이콘 + `← 목록으로` 링크 등 hero 와 중복되는 메타 영역은 제거 (ArticleHero 가 모두 흡수).

#### 5b. `src/components/MarkdownRenderer.tsx` 변경

- 컨테이너 className 에 `prose-fos` 추가 (글로벌 .prose 룰과 합쳐 mockup 톤 강화)
- mermaid 처리 변경 없음 — globals.css 의 selector 격리로 처리

#### 5c. `src/app/globals.css` prose 확장

```css
/* mockup 톤 prose — 기존 .prose 룰 확장 */
.prose h2 {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 56px 0 16px;
  color: var(--color-fg-primary);
  scroll-margin-top: 80px;
  counter-increment: prose-h2;
}
.prose {
  counter-reset: prose-h2;
}
.prose h2::before {
  content: counter(prose-h2, decimal-leading-zero);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-fg-muted);
  margin-right: 12px;
  letter-spacing: 0.04em;
}
.prose blockquote {
  border-left: 2px solid var(--color-brand-400);
  padding: 4px 0 4px 20px;
  margin: 24px 0;
  font-size: 16px;
  color: var(--color-fg-primary);
  font-style: normal;
}
.prose blockquote::before {
  content: "QUOTE";
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--color-brand-400);
  margin-bottom: 8px;
}
.prose :not(pre) > code {
  font-family: var(--font-mono);
  font-size: 0.88em;
  padding: 1px 6px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 4px;
  background: var(--color-bg-subtle);
  color: var(--color-brand-400);
}
.prose ul li::marker {
  content: "— ";
  color: var(--color-fg-faint);
}

/* mermaid 격리 (Q18 C) — 기존 prose pre 룰의 영향 차단 */
.prose pre.mermaid,
.prose pre:has(> code.language-mermaid) {
  background: transparent !important;
  border: none !important;
  padding: 0;
}
```

설계 메모:
- CSS counter (Q13 B) — JS 0, mockup 의 `data-idx` 부여 불필요. `decimal-leading-zero` 로 `01`/`02` 자동
- `:not(pre) > code` 로 inline code 만 새 스타일 (fenced code block 은 기존 rehype-highlight 그대로 — Q7 A)
- mermaid 격리는 `.mermaid` class 와 `language-mermaid` 둘 다 cover

### 통합 검증

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test -- --run
pnpm build

# mermaid 회귀 테스트 (Q10 A + Q18 C)
pnpm test -- --run mermaid
```

수동 smoke (선택, 사용자 PR 리뷰 시):
- `pnpm dev` → 글 상세 페이지 (다양한 카테고리: react / db / system / 한글 카테고리) 시각 확인
- 다크/라이트 토글
- 스크롤 시 Header 1px 라인 → progress fill 동작 확인 (글 상세 한정)
- 모바일 (Chrome DevTools 360px) → TOC 숨김 + Hero 단순화 + 본문 전체 폭 사용
- mermaid 다이어그램 글 (예: 알고리즘 카테고리) 에서 mermaid 정상 렌더 확인

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 신규 컴포넌트
test -f src/components/ArticleHero.tsx
test -f src/components/ArticleFooter.tsx
grep -n "export function ArticleHero" src/components/ArticleHero.tsx
grep -n "export function ArticleFooter" src/components/ArticleFooter.tsx
grep -n "getCategoryColor\|getCategoryHue" src/components/ArticleHero.tsx

# 2) page.tsx 가 ArticleHero / ArticleFooter / TableOfContents 모두 사용
grep -n "ArticleHero" src/app/posts/\[...slug\]/page.tsx
grep -n "ArticleFooter" src/app/posts/\[...slug\]/page.tsx
grep -n "TableOfContents" src/app/posts/\[...slug\]/page.tsx
grep -n 'level === 2' src/app/posts/\[...slug\]/page.tsx

# 3) Header reading progress 통합 (Q6 A)
grep -n '"use client"' src/components/Header.tsx
grep -n "usePathname" src/components/Header.tsx
grep -n "/posts/" src/components/Header.tsx
grep -n "var(--color-brand-400)" src/components/Header.tsx

# 4) TOC 리디자인 (in-place — 파일 그대로, 클래스만 새 토큰)
grep -nE 'var\(--color-(fg|border|brand)' src/components/TableOfContents.tsx
grep -n "font-mono" src/components/TableOfContents.tsx

# 5) globals.css prose 확장 (Q12 + Q13)
grep -n "counter-reset: prose-h2" src/app/globals.css
grep -n "counter-increment: prose-h2" src/app/globals.css
grep -n "decimal-leading-zero" src/app/globals.css
grep -nE "\.prose blockquote::before" src/app/globals.css
grep -n 'content: "QUOTE"' src/app/globals.css

# 6) mermaid 격리 (Q18 C)
grep -nE "pre\.mermaid|language-mermaid" src/app/globals.css

# 7) 3-col grid (모바일 단일 col, Q14 A + Q16 B)
grep -nE "md:grid-cols-\[1fr_minmax\(0,820px\)_240px\]" src/app/posts/\[...slug\]/page.tsx
grep -nE "hidden md:block" src/app/posts/\[...slug\]/page.tsx

# 8) frontmatter.tags graceful fallback (Q15 A)
grep -n "frontMatter.tags" src/app/posts/\[...slug\]/page.tsx

# 9) 회귀 + 빌드
pnpm test -- --run
pnpm lint
pnpm type-check
pnpm build

# 10) mermaid 회귀 테스트 명시 통과 (Q10 A)
pnpm test -- --run mermaid 2>&1 | grep -E "passed|failed"
! pnpm test -- --run mermaid 2>&1 | grep -E "failed"

# 11) 금지사항 (critic 반복 지적)
! grep -nE "as any" src/components/ArticleHero.tsx src/components/ArticleFooter.tsx src/components/Header.tsx
! grep -nE "console\.(log|warn|error)" src/components/ArticleHero.tsx src/components/ArticleFooter.tsx src/components/Header.tsx
! grep -nE "alert\(|confirm\(|prompt\(" src/components/ArticleHero.tsx src/components/ArticleFooter.tsx
```

## PHASE_BLOCKED 조건

- `--mesh-stop-01` 또는 `--color-cat-system` 토큰이 globals.css 에 없음 → **PHASE_BLOCKED: plan009 미머지**
- `src/lib/category-meta.ts` 의 `getCategoryHue` 미존재 → **PHASE_BLOCKED: plan010 미머지**
- Header 가 server component 로 작성되어 있고 다른 server-only 코드가 import 중이라 client 전환 불가 → **PHASE_BLOCKED: Header 분리 (HeaderInner client + Header server wrapper) 후속 결정 필요**
- mermaid 회귀 테스트 (`mermaid pre node detection`) 가 prose 변경 후 깨짐 → **PHASE_BLOCKED: selector 격리 재설계 (`.prose pre.mermaid` 가 cascade winner 인지 확인)**
- CSS counter `decimal-leading-zero` 가 일부 브라우저 미지원 → 무시 (Tailwind v4 / Next.js 16 대상 브라우저 모두 지원)

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋 (atomic commits 분리 권장):
- `feat(article): add ArticleHero with mesh gradient + breadcrumb + meta row`
- `feat(article): add ArticleFooter with frontmatter.tags graceful fallback`
- `feat(toc): redesign TableOfContents with mono sidebar tone`
- `feat(header): integrate reading progress fill on /posts/* pathname`
- `feat(prose): extend prose tokens with H2 counter + blockquote QUOTE label + inline code`
- `refactor(post-page): use new ArticleHero + 3-col grid + filter H2 TOC`
