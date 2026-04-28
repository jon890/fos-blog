# Phase 02 — CategoryDetailSubHero + SubfolderCard + PostListRow + ReadmeFrame + `/category/[...path]`

**Model**: sonnet
**Status**: pending

---

## 목표

Claude Design 핸드오프 (`fos-blog/project/categories.{jsx,css}`) 의 **B 페이지 (`/category/[...path]` Detail)** 을 구현한다. tinted sub-hero (좌 2px cat-color + 5% gradient), README card frame, SubfolderCard (folder icon + name + count + optional path chip + ↗ arrow), PostListRow (60px num / 1fr title+excerpt / 90px date+time, hover cat-color 좌 border + 4% bg).

기존 `/category/[...path]/page.tsx` 의 legacy `text-gray-*` / `bg-gray-*` / `bg-blue-100` 등은 모두 삭제. 새 컴포넌트로 전면 교체.

---

## 작업 항목 (5)

### 1. `src/components/CategoryDetailSubHero.tsx` 신규

phase 01 의 `CategoriesSubHero` 와 닮았지만 **tinted variant** 가 핵심. 별도 컴포넌트로 분리 (props 분기보다 명확):

```ts
interface CategoryDetailSubHeroProps {
  eyebrow: string;            // 예: "JAVA · SPRING" — uppercase 처리 호출자가 미리
  title: string;              // 예: "Spring"
  sublines: ReadonlyArray<string | { num: string | number; suffix: string }>;
  categorySlug: string;       // toCanonicalCategory 적용 후 cat-color hue 결정
}
```

스타일:
- 외곽 `<header>`: 같은 padding (`py-14 md:pt-14 md:pb-10`) + border-b
- **추가**: `border-l-2 border-[var(--cat-color)]` + bg `linear-gradient(to right, color-mix(in oklch, var(--cat-color), transparent 95%) 0%, transparent 40%)` (inline style)
- inline style: `--cat-color: getCategoryColor(categorySlug)`
- inner wrapper: `mx-auto max-w-[1180px] px-8`
- eyebrow: mono 11px uppercase tracking 0.08em **color `var(--cat-color)`** (brand 아님), `::before` 도 cat-color 1px×24px
- h1: 동일 (clamp 36–52px, font-semibold, tracking -0.025em)
- subline: 동일 패턴 (mono 13px, num 강조). 마지막 subline 은 path 표시 — `text-[var(--color-fg-faint)]` 톤 (예: `category/Java/Spring`)

### 2. `src/components/SubfolderCard.tsx` 신규

```ts
interface SubfolderCardProps {
  name: string;
  href: string;
  count?: number;             // 글 갯수 (선택)
  pathChip?: string;          // nested 부모 경로 표시 (예: "Spring/Data")
  categorySlug: string;
}
```

레이아웃 (mockup `.sub-card`):
- 외곽 `<Link>`: rounded-lg, border `--color-border-subtle`, **border-l-2 var(--cat-color)**, `bg-[var(--color-bg-elevated)]`, `p-[18px] pr-[16px] pb-4`, `flex items-start gap-3.5`, `relative overflow-hidden`
- folder icon (좌측 36×36): bg `color-mix(--cat-color, transparent 90%)`, border `1px solid color-mix(--cat-color, transparent 75%)`, color `var(--cat-color)`, lucide `Folder` w-4 h-4, `rounded-md`, `grid place-items-center flex-none`
- body (`flex-1 min-w-0`):
  - path-chip (있을 때): mono 10px tracking 0.02em color `var(--color-fg-faint)` mb-1.5, span 내부 color `var(--color-fg-muted)`
  - name: 15px font-semibold tracking -0.01em truncate text-`var(--color-fg-primary)` mb-1
  - meta: mono 11px gap-2 items-center, `n` (count) `text-[var(--color-fg-primary)] font-medium` + ` posts` `text-[var(--color-fg-muted)]`. pathChip 있으면 ` · nested` 추가 (sep `text-[var(--color-fg-faint)]`)
- arrow (절대 우상단): `top-[18px] right-4 absolute color-[var(--color-fg-faint)]`, lucide `ArrowUpRight` w-3.5 h-3.5
- hover: `-translate-y-0.5 border-[var(--cat-color)]`, arrow `text-[var(--cat-color)] translate-x-0.5 -translate-y-0.5`, transition `transform 200ms cubic-bezier(0.22,1,0.36,1) + border-color 150ms`

inline style 로 `--cat-color: getCategoryColor(categorySlug)`.

### 3. `src/components/PostListRow.tsx` 신규

mockup `.post-list-row`. server component, `<Link>` 외곽:

```ts
interface PostListRowProps {
  index: number;            // 1-based, "001" 패딩
  title: string;
  excerpt: string;
  href: string;
  updatedAt: Date;
  readingMinutes?: number;  // 없으면 표시 생략
  categorySlug: string;     // hover 좌 border 색
}
```

레이아웃:
- 외곽 wrapper (`<div className="post-list-rows">` 가 부모, 각 row 는 `<Link>`):
  - parent `border-t border-[var(--color-border-subtle)]` (첫 row 위)
  - row: `grid grid-cols-[60px_1fr_90px] gap-6 py-4.5 pl-4 border-b border-[var(--color-border-subtle)] items-center cursor-pointer relative border-l-2 border-l-transparent transition-[border-left-color,background] duration-150`
- 컬럼 1 num: mono 11px tracking 0.04em `text-[var(--color-fg-faint)]` — 표시 `— 001` (`String(index).padStart(3,"0")`)
- 컬럼 2 본문:
  - title: 15px font-medium tracking -0.01em `text-[var(--color-fg-primary)]` line-height 1.4 mb-1
  - excerpt: 13px `text-[var(--color-fg-secondary)]` line-clamp-1
- 컬럼 3 meta: mono 11px right-aligned `text-[var(--color-fg-muted)]`, 두 줄 — `formatYYYYMMDD(updatedAt)` + `<br/>` + `${readingMinutes} min` (없으면 day diff `formatRelativeKo`)
- hover: `border-l-[var(--cat-color)]`, bg `color-mix(in oklch, var(--cat-color), transparent 96%)` — inline style 또는 globals.css 의 `.post-list-row:hover` 규칙

`<Link href={...} className="post-list-row" style={{ "--cat-color": ... }}>` 패턴.

`readingMinutes` 는 phase 02 에서는 옵셔널 (DB 에 없음). 표시 안 되면 단순 `formatRelativeKo(updatedAt)` 만 두 번째 줄에 표시.

### 4. `src/components/ReadmeFrame.tsx` 신규

mockup `.readme` 의 **frame 만**. 본문 마크다운은 기존 `MarkdownRenderer` 가 렌더 — frame 이 wrapping.

```ts
interface ReadmeFrameProps {
  filename?: string;        // default "README"
  ext?: string;             // default ".md"
  categorySlug: string;
  children: ReactNode;       // MarkdownRenderer 결과
}
```

스타일:
- 외곽: rounded-lg border `--color-border-subtle` `bg-[var(--color-bg-elevated)] overflow-hidden`
- inline style: `--cat-color`
- head: `flex items-center gap-2.5 px-[18px] py-3 border-b border-[var(--color-border-subtle)] bg-[color-mix(in_oklch,var(--color-bg-subtle),transparent_50%)]`, mono 12px
  - file: `text-[var(--color-fg-secondary)]`
  - ext: `text-[var(--color-fg-faint)] -ml-1`
  - **last edited 우측 정렬은 Q3=제거 결정대로 표시 안 함**
- body wrapper: `px-7 py-7` (이미 MarkdownRenderer 가 prose-* 적용 — body 안에 별도 prose 적용 X)

mockup 의 `code` chip color `var(--cat-color)` 는 prose 의 `code` 를 cat-color 로 override 하기 위해 inline style 로 `--tw-prose-code: var(--cat-color)` 추가하거나 wrapper `:where(code):not(:where([class~="not-prose"] *))` CSS rule. **간단 처리**: ReadmeFrame body 의 직속 wrapper 에 inline style `[& code]:text-[var(--cat-color)]` 를 Tailwind v4 arbitrary 로 적용 (불가능 시 globals.css `.readme-body :where(code) { color: var(--cat-color); }` 추가).

### 5. `src/app/category/[...path]/page.tsx` 전면 교체

기존 (legacy gray-* / blue-100 / Folder w-12 lazy 카드) 모두 삭제 후:

```tsx
<>
  <BreadcrumbJsonLd items={...} />  {/* 기존 SEO 그대로 */}
  <Breadcrumb
    items={[
      { label: "fos-blog", href: "/" },
      { label: "categories", href: "/categories" },
      ...pathSegments.map((seg, i) => ({
        label: seg,
        href: i === pathSegments.length - 1 ? undefined : `/category/${...slice(0,i+1)...}`,
      })),
    ]}
  />
  <CategoryDetailSubHero
    eyebrow={pathSegments.map(s => s.toUpperCase()).join(" · ")}
    title={currentFolder}
    sublines={[
      ...(folders.length > 0 ? [{ num: folders.length, suffix: "폴더" }] : []),
      ...(posts.length > 0 ? [{ num: posts.length, suffix: "글" }] : []),
      `category/${pathSegments.join("/")}`,
    ]}
    categorySlug={category}
  />
  <main className="mx-auto max-w-[1180px] px-8 py-12 pb-20 space-y-14">
    {readme && (
      <CategoriesSection idx="README" title={`${currentFolder} 시리즈에 대하여`} meta="README.md">
        <ReadmeFrame categorySlug={category}>
          <MarkdownRenderer
            content={stripLeadingH1(parseFrontMatter(readme).content)}
            basePath={`${folderPath}/README`}
          />
        </ReadmeFrame>
      </CategoriesSection>
    )}
    {folders.length > 0 && (
      <CategoriesSection idx="01" title="하위 폴더" meta={`${folders.length} folders`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {folders.map((f) => (
            <SubfolderCard
              key={f.path}
              name={f.name}
              href={`/category/${f.path.split("/").map(encodeURIComponent).join("/")}`}
              count={f.count}
              pathChip={
                f.path.split("/").length > pathSegments.length + 1
                  ? f.path.split("/").slice(0, -1).join("/")
                  : undefined
              }
              categorySlug={category}
            />
          ))}
        </div>
      </CategoriesSection>
    )}
    {posts.length > 0 && (
      <CategoriesSection idx="02" title="이 폴더의 글" meta={`${posts.length} posts`}>
        <div className="post-list-rows" style={{ "--cat-color": getCategoryColor(category) } as CSSProperties}>
          {posts.map((p, i) => (
            <PostListRow
              key={p.path}
              index={i + 1}
              title={p.title}
              excerpt={p.excerpt ?? ""}
              href={`/posts/${encodeURIComponent(p.path)}`}
              updatedAt={p.updatedAt}
              categorySlug={category}
            />
          ))}
        </div>
      </CategoriesSection>
    )}
  </main>
</>
```

기존 `<header>` (이모지 + h1 + subtitle), 기존 `상위 폴더로` 링크, 기존 README 카드 (`bg-white dark:bg-gray-800`) 모두 삭제. Breadcrumb 가 nav 역할 일원화.

`PostCard` import 제거 (이 페이지에서 더이상 사용 안 함). `Link` / `ArrowLeft` / `Home` / `Folder` / `BookOpen` lucide import 정리 — Breadcrumb / SubfolderCard 내부로 이동.

`getCategoryColor` import: `@/lib/category-meta`.

mockup 의 `post-list-rows` hover 효과 (`border-l-color`, `bg color-mix`) 는 `src/app/globals.css` 에 다음 추가:

```css
.post-list-row {
  /* hover 효과만 — 그 외 클래스는 Tailwind */
}
.post-list-row:hover {
  border-left-color: var(--cat-color);
  background: color-mix(in oklch, var(--cat-color), transparent 96%);
}
```

(Tailwind arbitrary 로 `hover:bg-[color-mix(...)]` 가능하지만 가독성 떨어짐 — globals.css 한 블록 권장.)

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/components/CategoryDetailSubHero.tsx` | 신규 — tinted variant |
| `src/components/SubfolderCard.tsx` | 신규 — folder icon + path chip + ↗ |
| `src/components/PostListRow.tsx` | 신규 — 60/1fr/90 grid row |
| `src/components/ReadmeFrame.tsx` | 신규 — file/ext head + body wrapper |
| `src/app/category/[...path]/page.tsx` | 전면 교체 |
| `src/app/globals.css` | `.post-list-row:hover` cat-color border + bg |
| `src/components/MarkdownRenderer.regression-1.test.ts` | (영향 시) 카테고리 페이지 README 렌더 회귀 — 영향 없음 예상 |

## 검증

```bash
pnpm lint
pnpm type-check
pnpm test --run

# legacy 잔재 (Category Detail 한정)
! grep -nE "text-gray-(900|700|500|400)|bg-gray-(100|200|800)|bg-blue-(100|500)|text-blue-400|bg-white" \
    src/app/category/[...path]/page.tsx \
    src/components/CategoryDetailSubHero.tsx \
    src/components/SubfolderCard.tsx \
    src/components/PostListRow.tsx \
    src/components/ReadmeFrame.tsx

# 신규 컴포넌트 토큰 사용
grep -n "var(--cat-color)" src/components/SubfolderCard.tsx
grep -n "var(--cat-color)" src/components/PostListRow.tsx
grep -n "var(--cat-color)" src/components/CategoryDetailSubHero.tsx
```

수동 smoke (`pnpm dev`):
- `/category/Java` (1단 깊이) — eyebrow `JAVA` cat-color, h1 "Java", sub-hero 좌 border + 5% gradient bg
- `/category/Java/Spring` (2단) — eyebrow `JAVA · SPRING`, breadcrumb `fos-blog / categories / Java / Spring`
- README 카드: head `README` + `.md` faint, body code chip cat-color, 마크다운 본문 정상 렌더
- 하위 폴더 카드: hover 시 -2px lift + border cat-color + arrow translate
- PostListRow: hover 시 좌 border cat-color + bg 4% mix, 컬럼 정렬 (num / title+excerpt / date+min)
- 다크/라이트 양 모드

## 의도 메모

- **CategoryDetailSubHero 분리** 이유: tinted variant 가 base sub-hero 와 시각 차이 큼 (border + gradient). props 분기보다 두 컴포넌트가 명확. 향후 다른 페이지에서 base sub-hero 만 가져다 쓸 때도 깔끔
- **PostListRow 신규** 이유: PostCard 와 정보 밀도/레이아웃이 다름 (3-컬럼 grid + num enumerate + cat-color hover). 카테고리 detail 전용 — 인덱스 (`/posts/latest`) 는 plan016 이 PostCard 그대로
- **path chip** 적용 조건: subfolder 의 `path` 깊이 가 현재 pathSegments + 1 보다 크면 (즉 grandchild 가 직접 노출되는 경우만) 표시. 일반 1단 깊이 자식엔 chip 미표시
- **mockup 의 desc 미구현** 은 phase 01 와 동일 사유 (DB 컬럼 없음)
