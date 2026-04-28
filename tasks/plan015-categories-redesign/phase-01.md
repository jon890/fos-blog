# Phase 01 — CategoriesSubHero + Breadcrumb + CategoryFeatured + CategoryCard 재구성 + `/categories`

**Model**: sonnet
**Status**: pending

---

## 목표

Claude Design 핸드오프 (`fos-blog/project/categories.{jsx,css}`) 의 **A 페이지 (`/categories` Index)** 을 구현한다. 신규 토큰 추가 없이 plan009 의 `--color-cat-*` + bg/fg/border 토큰만 사용. mockup 의 좌 2px cat-color accent + radial gradient hover blob + foot 영역 (count + view ↗) 패턴을 충실히 재현.

**참고 핸드오프 위치**: `/tmp/fos-design-categories/fos-blog/project/categories.{jsx,css}` (gzip 풀어둔 상태). 다시 풀어야 하면 webfetch 결과 bin (`~/.claude/projects/-Users-nhn-personal-fos-blog/d11b8756-7896-451b-932e-0678c2241d67/tool-results/webfetch-1777346152645-o83bwy.bin`) 을 `tar xzf` 로 풀면 됨.

---

## 작업 항목 (5)

### 1. `src/infra/db/repositories/CategoryRepository.ts` — `getCategoriesWithLatest()` 추가

기존 `getCategories()` 와 별도. 카테고리 목록 + 카테고리별 max(`posts.updatedAt`) 을 한 번에 반환:

```ts
async getCategoriesWithLatest(): Promise<Array<CategoryData & { latestUpdatedAt: Date | null }>>
```

구현 — Drizzle subquery 또는 LEFT JOIN:

```ts
// posts.category 와 categories.slug 매칭 (raw category key) — toCanonicalCategory 매핑은 app 레이어에서
const result = await this.db
  .select({
    name: categories.name,
    slug: categories.slug,
    icon: categories.icon,
    postCount: categories.postCount,
    latestUpdatedAt: sql<Date | null>`MAX(${posts.updatedAt})`,
  })
  .from(categories)
  .leftJoin(posts, and(eq(posts.category, categories.slug), eq(posts.isActive, true)))
  .groupBy(categories.id)
  .orderBy(desc(categories.postCount));
```

기존 `getCategories()` 는 그대로 유지 (다른 호출자 영향 차단). 새 메서드는 `/categories` 페이지에서만 호출.

### 2. `src/components/CategoriesSubHero.tsx` 신규

server component. props:

```ts
interface CategoriesSubHeroProps {
  eyebrow: string;          // "INDEX · CATEGORIES"
  title: string;             // "카테고리"
  sublines: Array<string | { num: string | number; suffix: string }>;
  // 예: [{ num: 9, suffix: "개 주제" }, { num: 226, suffix: "개의 글" }, "updated 2026.04.27"]
}
```

구조 (mockup `.subhero` + `.subhero-inner`):
- 외곽 `<header>`: `border-b border-[var(--color-border-subtle)] py-14 md:pt-14 md:pb-10`
- inner: `mx-auto max-w-[1180px] px-8`
- eyebrow: mono 11px, uppercase, tracking 0.08em, color `var(--color-brand-400)`, 좌측 `::before` 1px×24px brand line (실제로는 `<span className="block h-px w-6 bg-[var(--color-brand-400)]" />`)
- h1: `clamp(36px,4vw,52px) font-semibold leading-[1.1] tracking-[-0.025em] text-[var(--color-fg-primary)] mt-5`
- subline: mono 13px, gap-3, items-center, flex-wrap, color `var(--color-fg-muted)`
  - `num` part: `text-[var(--color-fg-primary)] font-medium`
  - sep `·`: `text-[var(--color-fg-faint)]`

### 3. `src/components/Breadcrumb.tsx` 신규

mockup 의 `.crumb-row` 를 컴포넌트화. 다른 페이지에서도 재사용 가능하게 일반화 (Categories detail phase 02 에서도 사용).

```ts
interface BreadcrumbItem {
  label: string;
  href?: string;       // undefined 면 현재 페이지 (cur)
}
interface BreadcrumbProps {
  items: BreadcrumbItem[];   // 첫 번째 항목 앞에 home icon 자동 prefix
}
```

스타일:
- wrapper: `mx-auto max-w-[1180px] px-8 pt-[18px] flex items-center gap-2 font-mono text-[12px] text-[var(--color-fg-muted)]`
- 각 link: `inline-flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:text-[var(--color-fg-primary)] hover:bg-[var(--color-bg-subtle)]`
- 현재 페이지 (`href` 없음): `text-[var(--color-fg-primary)] pointer-events-none`
- separator `/`: `text-[var(--color-fg-faint)] select-none`
- home icon: lucide `Home` w-3 h-3, 첫 번째 항목 앞에 inline 표시

### 4. `src/components/CategoryFeatured.tsx` 신규 (top-3 featured 카드)

server component. props:

```ts
interface CategoryFeaturedProps {
  category: CategoryData;
  rank: number;           // 1, 2, 3
  latestUpdatedAt: Date | null;
}
```

레이아웃 (mockup `.cat-featured`):
- 외곽: rounded-lg, border `--color-border-subtle`, **border-l 2px solid `var(--cat-color)`**, `min-h-[220px]`, `p-7 pb-6`
- 배경: `linear-gradient(to bottom right, color-mix(in oklch, var(--cat-color), transparent 92%) 0%, transparent 60%)`, `var(--color-bg-elevated)` 위에 합성
- inline style 로 `--cat-color: getCategoryColor(category.slug)` 주입
- `rank` badge: `top-3.5 right-4 absolute font-mono text-[10px] tracking-[0.1em] text-[var(--color-fg-faint)]` — 표시는 `#01`, `#02`, `#03` (`String(rank).padStart(2,"0")`)
- head row: 36px tinted icon (`bg: color-mix(--cat-color, transparent 88%)`, `border: 1px solid color-mix(--cat-color, transparent 70%)`, `text: var(--cat-color)`) + key (mono 10px uppercase tracking 0.1em, color `var(--cat-color)`)
- icon source: `category.icon` (DB) — 기존 emoji icon 유지. lucide icon 매핑은 phase 03 에서 검토 (이번 phase 는 emoji 그대로)
- h3: 22px font-semibold, tracking -0.018em, mt-1
- desc: hidden (DB 에 description 컬럼 없음 — mockup 의 desc 는 hardcode). **이 phase 에서는 desc 영역을 생략**하고 h3 와 foot 사이 `flex-1` spacer 만 둠. 향후 컬럼 추가 시 채우기.
- foot: `mt-auto pt-3 border-t border-[var(--color-border-subtle)]`, mono 11px
  - 좌측 count: `text-[var(--color-fg-primary)] font-medium text-[16px]` + ` posts` mono 11px
  - 우측 latest: mono 11px `text-[var(--color-fg-muted)]` + `· {relative}` `text-[var(--color-fg-secondary)]`. relative 표기는 `formatDistanceToNow` 직접 구현 (예: "3일 전", "1주 전") — `latestUpdatedAt` null 이면 `—`
- hover: `hover:-translate-y-0.5 hover:border-[var(--cat-color)]` transition `transform 200ms cubic-bezier(0.22,1,0.36,1)`

`href`: `/category/${encodeURIComponent(category.slug)}`. 외곽은 `<Link>` 로.

**relative time helper**: 인라인 또는 `src/lib/time.ts` 신규 헬퍼:
```ts
export function formatRelativeKo(date: Date | null): string {
  if (!date) return "—";
  const now = Date.now();
  const diff = now - date.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < 7 * day) return `${Math.max(1, Math.floor(diff / day))}일 전`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}주 전`;
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))}개월 전`;
  return `${Math.floor(diff / (365 * day))}년 전`;
}
```

별도 파일로 두면 phase 02 의 SubfolderCard 등에서도 재사용 가능.

### 5. `src/components/CategoryCard.tsx` 재구성 + `src/app/categories/page.tsx` 교체

**5-A. `CategoryCard.tsx` 재구성**:

기존 카드 (좌 2px line + icon + count + canonical key) 를 mockup `.cat-card` 톤으로 변경:
- 외곽: rounded-lg, border, **border-l 2px solid var(--cat-color)**, `bg-[var(--color-bg-elevated)]`, `p-[22px] pb-5`, `flex flex-col gap-2`
- head row: 28px tinted icon + key (mono 10px uppercase color cat-color, 우측 정렬)
- h3: 17px font-semibold tracking -0.012em
- foot: `mt-3.5 pt-3 border-t border-[var(--color-border-subtle)]`, mono 11px
  - 좌: count `text-[var(--color-fg-primary)] font-medium text-[13px]` + ` posts` mono 11px
  - 우: arrow `view <ArrowUpRight />` (lucide). hover 시 `gap` 4 → 8, `color: var(--cat-color)`
- hover: `-translate-y-0.5`, border `var(--cat-color)`, `::after` radial gradient blob (`radial-gradient(60% 80% at 100% 0%, var(--cat-color), transparent 60%)`, `mix-blend-mode: screen`, dark mode 6%, light mode 8% — `light:` prefix 또는 CSS-in-JS).

mix-blend-mode 는 inline style 로 처리하거나 `src/app/globals.css` 에 `.cat-card` `.cat-card::after` 규칙 추가. **권장: globals.css 에 helper class** (`.cat-card-blob` 같은) 추가 — Tailwind v4 의 inline arbitrary 로 표현 어려움 (mix-blend-mode + 가상 요소).

`category.icon` (emoji) 그대로 사용. 외곽 `<Link>`.

**5-B. `src/app/categories/page.tsx` 교체**:

현재 구조 (단순 h1 + CategoryList) → 다음으로:

```tsx
<>
  <Breadcrumb items={[{ label: "fos-blog", href: "/" }, { label: "categories" }]} />
  <CategoriesSubHero
    eyebrow="INDEX · CATEGORIES"
    title="카테고리"
    sublines={[
      { num: categories.length, suffix: "개 주제" },
      { num: totalCount, suffix: "개의 글" },
      `updated ${formatYYYYMMDD(maxLatestUpdatedAt)}`,
    ]}
  />
  <main className="mx-auto max-w-[1180px] px-8 py-12 pb-20">
    <Section idx="01" title="Most active" meta="top 3 · 카테고리 전체 기준">
      <div className="grid grid-cols-3 gap-3">
        {top3.map((c, i) => (
          <CategoryFeatured key={c.slug} category={c} rank={i + 1} latestUpdatedAt={c.latestUpdatedAt} />
        ))}
      </div>
    </Section>
    <Section idx="02" title="All categories" meta={`${rest.length} canonical · alphabetical`}>
      <div className="grid grid-cols-3 gap-3">
        {rest.map((c) => <CategoryCard key={c.slug} category={c} />)}
      </div>
    </Section>
  </main>
</>
```

`Section` 은 phase 내 inline helper 또는 별도 컴포넌트 (`src/components/CategoriesSection.tsx`):
- head: `flex items-baseline justify-between mb-5 pb-3.5 border-b border-[var(--color-border-subtle)]`
  - 좌: h2 18px font-semibold tracking -0.01em + `<span className="font-mono text-[11px] text-[var(--color-fg-faint)] tracking-[0.08em] font-normal mr-3">{idx}</span>`
  - 우: meta mono 11px `text-[var(--color-fg-muted)]`

**Q1 결정 적용**: top-3 = `categories.slice(0, 3)` (이미 postCount desc 정렬). "지난 30일" 윈도우는 도입 안 함 — section meta 문구도 `top 3 · 카테고리 전체 기준` 으로 mockup 의 "지난 30일" 은 변경.

`maxLatestUpdatedAt = max(latestUpdatedAt) over categories` 로 sub-hero subline `updated YYYY.MM.DD` 계산.

`/categories/page.tsx` 의 기존 `CategoryList` import 제거. 그러나 `CategoryList` 컴포넌트는 다른 곳에서 안 쓰면 phase 02 에서 정리 (이번 phase 는 안 건드림 — 변경 범위 최소화).

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/infra/db/repositories/CategoryRepository.ts` | `getCategoriesWithLatest()` 추가 |
| `src/lib/time.ts` | `formatRelativeKo`, `formatYYYYMMDD` 신규 |
| `src/components/CategoriesSubHero.tsx` | 신규 |
| `src/components/Breadcrumb.tsx` | 신규 — Categories + Detail 양쪽 사용 |
| `src/components/CategoryFeatured.tsx` | 신규 |
| `src/components/CategoryCard.tsx` | 재구성 (foot + hover blob + view arrow) |
| `src/components/CategoriesSection.tsx` | 신규 — section head helper (idx + h2 + meta) |
| `src/app/globals.css` | `.cat-card::after` radial blob 규칙 (mix-blend-mode + opacity transition) |
| `src/app/categories/page.tsx` | 헤더 + 두 섹션 통합 |

## 검증 (이 phase 한정)

```bash
pnpm lint
pnpm type-check
pnpm test --run

# 신규 컴포넌트 토큰 사용 확인
grep -n "var(--color-brand-400)" src/components/CategoriesSubHero.tsx
grep -n "var(--cat-color)" src/components/CategoryFeatured.tsx
grep -n "var(--cat-color)" src/components/CategoryCard.tsx

# legacy 색 잔재 (Categories Index 한정)
! grep -nE "text-gray-(900|500|400)|bg-gray-|text-blue-500" \
    src/app/categories/page.tsx \
    src/components/CategoriesSubHero.tsx \
    src/components/CategoryFeatured.tsx \
    src/components/CategoryCard.tsx \
    src/components/CategoriesSection.tsx \
    src/components/Breadcrumb.tsx
```

수동 smoke (`pnpm dev`):
- `/categories` — eyebrow `INDEX · CATEGORIES` brand color, h1 "카테고리", subline mono `N 주제 · M 글 · updated YYYY.MM.DD`
- top-3 카드: rank `#01/#02/#03` 우상단, cat-color tinted gradient bg, hover -2px lift
- 6 카드 grid: hover 시 좌 border + 우상단 radial blob 약하게 표시, foot view ↗ 가 cat-color 로 변경
- breadcrumb: home icon + `fos-blog / categories` (현재)
- light/dark 양 모드 hover blob 차등 (dark `screen`, light `multiply`)

## 의도 메모

- **`getCategoriesWithLatest()` 신설** 이유: 기존 `getCategories()` 의 호출자(API route, sitemap 등) 영향 없이 페이지 단일 호출만 latest delta 가져오게. 한 번의 LEFT JOIN + GROUP BY 로 N+1 회피
- **CategoryFeatured 와 CategoryCard 분리** 이유: featured 는 desc 자리 + rank + latest delta 가 추가, base card 와 정보 밀도/높이가 다름. 한 컴포넌트에 variant prop 으로 묶으면 분기 폭증
- **mockup desc 미구현** 이유: DB 에 description 컬럼 없음. mockup 의 desc 는 mock data — 향후 컬럼 추가 또는 README 첫 단락 추출 시 채우기. 이 phase 에서 무리해 영입하지 않음
- **mix-blend-mode 가상 요소를 globals.css 로 분리** 이유: Tailwind v4 의 inline arbitrary 로 `::after { mix-blend-mode: screen }` 표현 불가능. 한정된 helper class 한 개로 격리
