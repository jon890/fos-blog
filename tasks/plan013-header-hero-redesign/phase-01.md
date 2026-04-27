# Phase 01 — Header mono nav + brand mark + HomeHero (eyebrow/h1/caret/dl) + HeroMesh SVG + 토큰 정렬

## 컨텍스트 (자기완결 프롬프트)

plan009 (design tokens) + plan011 (article page redesign) 머지 완료 전제. Claude Design Round 2 의 `app-base.jsx` (라인 23-165) 의 `HeroMesh / TopBar / Hero` 패턴을 fos-blog 의 Header + 홈 Hero 에 적용. mockup 자체가 design-tokens 페이지용이라 nav 항목과 Hero 메타는 fos-blog 용으로 재정의 — **패턴만 차용, 콘텐츠는 새로**.

scope 외 (별도 plan/issue 분리):
- Footer 리디자인 → **plan013-2** (Footer 추가 mockup 도착 후 별도 plan)
- Density 토글 (mockup 의 `data-density="compact|default|spacious"`) → **plan011/014** 또는 별도
- 검색 다이얼로그 / 사이드바 → **plan014**
- Canvas 기반 mesh 애니메이션 → 채택 안 함 (Lighthouse 영향 우려) — SVG + CSS 정적 회전으로 대체

### 현재 baseline (변경 대상)

`src/components/Header.tsx` (194 라인):
- `"use client"`, `usePathname`, `Header` 컴포넌트
- 6 기능: Logo (📚 + "FOS Study"), Desktop Nav (홈/카테고리), Sidebar Toggle, Search Button (Cmd+K), GitHub link, ThemeToggle, 모바일 햄버거
- **plan011 의 reading progress 통합 이미 적용됨** (라인 17-33, 175-191) — 이번 phase 는 그대로 보존
- 색은 모두 `bg-white/80 dark:bg-gray-950/80`, `text-gray-600 dark:text-gray-400`, `text-blue-600 dark:text-blue-400` 등 하드코딩 — **이번 phase 에서 새 토큰으로 정렬**

`src/app/page.tsx`:
- 홈 페이지. 첫 섹션 `{/* Hero Section */}` 영역 (라인 64 부근) 이 현재 Hero. **이번 phase 에서 `<HomeHero>` 컴포넌트로 교체**

`src/app/layout.tsx`:
- Footer 인라인 (라인 144-240) — **이번 phase 변경 없음**. plan013-2 후속.

`src/app/globals.css` (plan011 후):
- `--color-bg-base`, `--color-fg-primary`, `--color-border-subtle`, `--font-mono`, `--font-sans`, `--mesh-stop-01~06`, `--color-brand-400` 모두 정의됨
- Hero mesh / Header 새 룰을 위한 추가 공간 충분

### 이 phase 의 핵심 전환

1. **Header**: 6 기능 모두 유지 (Q3 A) + nav 라벨에 mono prefix `01 / 홈` `02 / 카테고리` 적용 (Q3 D) + brand 변경 (`📚 FOS Study` → `● fos-blog/study`, mockup 의 `.brand-mark .dot` 패턴) + 모든 색을 새 토큰으로 정렬 (`var(--color-bg-base)` etc)
2. **HomeHero (신규)**: mockup `Hero` 패턴의 React 변형. eyebrow + h1 with `<em>` 강조 + caret 깜빡임 + lead + `<dl>` 4 통계 항목 (Q4 A — posts/categories/last-update/github)
3. **HeroMesh (신규, SVG + CSS rotate)**: Q2 D — Canvas 대신 SVG `<radialGradient>` 3 stops + CSS `transform: rotate` 60s slow animation. Lighthouse 친화 (JS 0, GPU 가속). `prefers-reduced-motion` 지원
4. **Hero 영역의 카테고리 그리드 / Popular / Recent posts 는 기존 그대로** — 이번 phase 는 첫 Hero 섹션만 교체

## 먼저 읽을 문서

- `docs/adr.md` — **ADR-017** (디자인 시스템)
- `docs/design-inspiration.md` — Round 2 mockup 메모
- `/tmp/app-base.jsx` (Round 2 추출) — `HeroMesh / TopBar / Hero` 함수 (라인 23-165)
- `src/components/Header.tsx` — 현재 6 기능
- `src/app/page.tsx` — 현재 Hero Section 영역
- `src/app/globals.css` — plan009/011 토큰
- `.claude/skills/_shared/common-critic-patterns.md` — 시드 7 패턴

## 사전 게이트

```bash
# cwd: <worktree root>

# 1) plan009 + plan011 머지 완료
grep -n -- "--mesh-stop-01" src/app/globals.css
grep -n -- "--color-fg-primary" src/app/globals.css
grep -n "ArticleHero" src/app/posts/\[...slug\]/page.tsx
grep -n "isArticle" src/components/Header.tsx  # plan011 의 reading progress 통합 확인

# 2) 기존 컴포넌트
test -f src/components/Header.tsx
test -f src/app/page.tsx
test -f src/app/layout.tsx
grep -nE "📚 FOS Study|FOS Study" src/components/Header.tsx | head -3

# 3) Round 2 mockup 추출
tar xzOf ~/.claude/projects/-Users-nhn-personal-fos-blog/d11b8756-7896-451b-932e-0678c2241d67/tool-results/webfetch-1777098410179-5850mb.bin 'fos-blog/project/app-base.jsx' > /tmp/app-base.jsx
grep -nE "function (HeroMesh|TopBar|Hero)" /tmp/app-base.jsx | head -5

# 4) repository 통계 함수 확인 — HomeHero 의 dl 항목용
grep -n "getCategoryCount\|count.*posts\|getRecentPosts\|getCategories" src/infra/db/repositories/*.ts | head -10
```

위 항목 중 어느 하나라도 실패하면 **PHASE_BLOCKED: plan009/plan011 선행 필요 또는 repository 함수 추가 필요**.

## 작업 목록 (총 5개)

### 1. `src/components/HeroMesh.tsx` 신규 (server, SVG + CSS rotate)

```tsx
import type { CSSProperties } from "react";

interface HeroMeshProps {
  /** 첫 stop 의 hue (degrees) — 카테고리/페이지별 변형 시 활용. 기본 195 (brand cyan) */
  primaryHue?: number;
  /** 모션 강도 — "default" | "subtle" | "off". prefers-reduced-motion 자동 처리 */
  motion?: "default" | "subtle" | "off";
}

export function HeroMesh({ primaryHue = 195, motion = "default" }: HeroMeshProps) {
  const motionClass =
    motion === "off"
      ? "hero-mesh--no-motion"
      : motion === "subtle"
        ? "hero-mesh--subtle"
        : "hero-mesh--default";

  return (
    <div
      aria-hidden
      className={`hero-mesh ${motionClass}`}
      style={{ "--mesh-primary-hue": primaryHue } as CSSProperties}
    >
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="hero-mesh-svg">
        <defs>
          <radialGradient id="mesh-stop-1" cx="20%" cy="30%" r="60%">
            <stop offset="0%" stopColor="oklch(0.7 0.16 var(--mesh-primary-hue))" stopOpacity="0.55" />
            <stop offset="60%" stopColor="oklch(0.7 0.16 var(--mesh-primary-hue))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mesh-stop-2" cx="80%" cy="35%" r="55%">
            <stop offset="0%" stopColor="var(--mesh-stop-03)" stopOpacity="0.4" />
            <stop offset="60%" stopColor="var(--mesh-stop-03)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mesh-stop-3" cx="50%" cy="80%" r="60%">
            <stop offset="0%" stopColor="var(--mesh-stop-02)" stopOpacity="0.45" />
            <stop offset="60%" stopColor="var(--mesh-stop-02)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect className="mesh-layer mesh-layer-1" width="100" height="60" fill="url(#mesh-stop-1)" />
        <rect className="mesh-layer mesh-layer-2" width="100" height="60" fill="url(#mesh-stop-2)" />
        <rect className="mesh-layer mesh-layer-3" width="100" height="60" fill="url(#mesh-stop-3)" />
      </svg>
    </div>
  );
}
```

설계 메모:
- **server component** (interactivity 0). 모션은 순수 CSS keyframes
- `--mesh-primary-hue` CSS variable 로 카테고리/페이지별 변형 가능 (글 상세 ArticleHero 에서도 재사용 가능)
- `prefers-reduced-motion: reduce` 는 globals.css 에서 자동 처리
- viewBox 100x60 + preserveAspectRatio="none" 으로 컨테이너 fill (SVG 의 일반 패턴)

### 2. `src/components/HomeHero.tsx` 신규 (server)

```tsx
import { HeroMesh } from "./HeroMesh";

interface HomeHeroProps {
  postCount: number;
  categoryCount: number;
  lastUpdate: Date | null;
  githubRepo: string;  // "jon890/fos-study"
}

function formatLastUpdate(date: Date | null): string {
  if (!date) return "";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export function HomeHero({ postCount, categoryCount, lastUpdate, githubRepo }: HomeHeroProps) {
  return (
    <header className="hero relative overflow-hidden border-b border-[var(--color-border-subtle)] px-6 pt-20 pb-16 md:pt-28 md:pb-24">
      <HeroMesh primaryHue={195} />
      <div
        aria-hidden
        className="hero-grid pointer-events-none absolute inset-0 z-[1]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-border-subtle) 1px, transparent 1px)",
          backgroundSize: "80px 100%",
          maskImage: "linear-gradient(to bottom, transparent, black 30%, black 80%, transparent)",
        }}
      />

      <div className="container relative z-[2] mx-auto max-w-[880px]">
        <div className="hero-eyebrow font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-fg-muted)]">
          FOS-BLOG · 한국어 개발 학습 · 2026
        </div>

        <h1 className="mt-5 max-w-[20ch] text-[34px] font-semibold leading-[1.1] tracking-tight text-[var(--color-fg-primary)] md:text-[56px]">
          기록은 가장 빠른 학습입니다
          <em className="not-italic font-mono text-[var(--color-brand-400)]"> (.posts)</em>
          <span className="hero-caret" aria-hidden />
        </h1>

        <p className="mt-6 max-w-[56ch] text-[16px] leading-relaxed text-[var(--color-fg-secondary)] md:text-[18px]">
          개발하면서 마주친 문제와 해소 과정을 글로 남깁니다. JavaScript / TypeScript /
          알고리즘 / DB / DevOps 의 학습 기록을 한 곳에 모았어요.
        </p>

        <dl className="hero-meta mt-10 grid grid-cols-2 gap-x-8 gap-y-4 font-mono text-[12px] md:grid-cols-4">
          <div>
            <dt className="text-[var(--color-fg-muted)] uppercase tracking-[0.06em]">posts</dt>
            <dd className="mt-1 text-[var(--color-fg-primary)]">{postCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-fg-muted)] uppercase tracking-[0.06em]">categories</dt>
            <dd className="mt-1 text-[var(--color-fg-primary)]">{categoryCount}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-fg-muted)] uppercase tracking-[0.06em]">last update</dt>
            <dd className="mt-1 text-[var(--color-fg-primary)]">{formatLastUpdate(lastUpdate)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-fg-muted)] uppercase tracking-[0.06em]">github</dt>
            <dd className="mt-1">
              <a
                href={`https://github.com/${githubRepo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-brand-400)] hover:underline"
              >
                {githubRepo}
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
```

설계 메모:
- 모든 색 토큰화 (mockup 의 `<em>` 강조는 brand-400 mono 색)
- caret 깜빡임은 globals.css 의 `.hero-caret` 룰 + keyframes
- `<dl>` 4 항목 (Q4 A) — server side 에서 props 로 데이터 받음 (page.tsx 가 repository 호출)
- max-width 880px (mockup 880px 그대로, plan011 ArticleHero 와 일관)

### 3. `src/components/Header.tsx` 토큰 정렬 + mono nav 라벨

기존 6 기능 + plan011 의 reading progress 통합 모두 보존. **변경**:

a) **brand**: `📚 FOS Study` → mockup `.brand-mark .dot` 패턴
```tsx
<Link href="/" className="brand-mark flex items-center gap-2 font-mono text-[14px] tracking-tight text-[var(--color-fg-primary)] hover:text-[var(--color-brand-400)] transition-colors">
  <span
    aria-hidden
    className="h-2 w-2 rounded-full bg-[var(--color-brand-400)]"
    style={{ boxShadow: "0 0 8px var(--color-brand-400)" }}
  />
  fos-blog<span className="text-[var(--color-fg-muted)]">/study</span>
</Link>
```

b) **nav 라벨**: `홈` → `01 / 홈`, `카테고리` → `02 / 카테고리` (mono prefix, mockup 의 design-tokens TopBar 패턴)
```tsx
const navLinks = [
  { href: "/", label: "01 / 홈", icon: Home },
  { href: "/categories", label: "02 / 카테고리", icon: Book },
];
```
nav className 도 토큰화: `text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)]`, active 는 `text-[var(--color-brand-400)]`. 폰트는 `font-mono text-[12px]`. 아이콘은 모바일에서만 (또는 유지 — 정보 손실 0).

c) **container**: `bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm` → `bg-[var(--color-bg-base)]/80 backdrop-blur-md saturate-140`. dark mode 자동 처리 (토큰이 `:root` / `:root:not(.dark)` 분기).

d) **모든 텍스트/border/hover 색 토큰화**: 모바일 메뉴 / 검색 버튼 / GitHub 링크 / 사이드바 토글 모두 `var(--color-fg-*)` `var(--color-border-*)` 사용. 기존 Tailwind gray/blue 클래스 제거.

e) **plan011 reading progress 코드 변경 없음** (라인 17-33, 175-191).

### 4. `src/app/page.tsx` — `<HomeHero>` 통합

기존 Hero Section 영역을 `<HomeHero>` 로 교체.

```tsx
// page.tsx 상단에 추가
import { HomeHero } from "@/components/HomeHero";

// HomePage 내부의 데이터 fetch 부분에 추가:
const [categories, recentPosts, popularPosts, postCountTotal] = await Promise.all([
  category.getCategories(),
  post.getRecentPosts(6),
  getPopularPosts(6),
  post.getActivePostCount(),  // 신규 — repository 추가 필요 (없으면 작업 5에서 추가)
]);

const lastUpdate = recentPosts[0]?.updatedAt ?? recentPosts[0]?.createdAt ?? null;
const categoryCount = categories.length;

// JSX:
return (
  <>
    <WebsiteJsonLd … />
    <HomeHero
      postCount={postCountTotal}
      categoryCount={categoryCount}
      lastUpdate={lastUpdate}
      githubRepo="jon890/fos-study"
    />
    <main className="container mx-auto px-4 py-12 md:py-16">
      {/* 기존 카테고리/Popular/Recent 섹션 그대로 */}
    </main>
  </>
);
```

기존 `{/* Hero Section */}` JSX 블록 (가장 첫 시각 영역) 은 **모두 제거** 후 `<HomeHero>` 로 대체. 카테고리 그리드 + Popular + Recent 섹션은 그대로 유지.

### 5. `src/app/globals.css` — Header glass + Hero mesh + caret keyframes + post count repository

#### 5a. globals.css 추가 룰

```css
/* === Hero Mesh === */
.hero-mesh {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  filter: blur(40px) saturate(140%);
}
.hero-mesh-svg {
  width: 100%;
  height: 100%;
}
.hero-mesh-svg .mesh-layer {
  transform-origin: 50% 50%;
}
.hero-mesh--default .mesh-layer-1 { animation: mesh-rotate-slow 60s linear infinite; }
.hero-mesh--default .mesh-layer-2 { animation: mesh-rotate-slow 90s linear infinite reverse; }
.hero-mesh--default .mesh-layer-3 { animation: mesh-rotate-slow 75s linear infinite; }
.hero-mesh--subtle .mesh-layer-1 { animation: mesh-rotate-slow 120s linear infinite; }
.hero-mesh--subtle .mesh-layer-2 { animation: mesh-rotate-slow 180s linear infinite reverse; }
.hero-mesh--subtle .mesh-layer-3 { animation: mesh-rotate-slow 150s linear infinite; }
.hero-mesh--no-motion .mesh-layer { animation: none; }
@keyframes mesh-rotate-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .hero-mesh .mesh-layer { animation: none !important; }
}
.ab.light .hero-mesh { opacity: 0.55; }

/* === Hero caret === */
.hero-caret {
  display: inline-block;
  width: 8px;
  height: 1em;
  background: var(--color-brand-400);
  margin-left: 4px;
  vertical-align: text-bottom;
  animation: hero-caret-blink 1.05s steps(1) infinite;
}
@keyframes hero-caret-blink {
  50% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .hero-caret { animation: none; opacity: 0.6; }
}

/* === Header brand-mark dot === */
/* 인라인 className 으로 처리 — 별도 룰 불필요 */
```

#### 5b. `post.getActivePostCount()` repository 함수 (없으면 추가)

먼저 grep 으로 확인:
```bash
# cwd: <worktree root>
grep -n "getActivePostCount\|countActivePosts\|count.*isActive" src/infra/db/repositories/*.ts
```

존재하면 사용. 없으면 `src/infra/db/repositories/post.ts` (또는 PostRepository 가 있는 파일) 에 다음 추가:
```ts
async getActivePostCount(): Promise<number> {
  const result = await this.db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(eq(posts.isActive, true));
  return result[0]?.count ?? 0;
}
```

이 함수는 PostService 또는 page.tsx 에서 직접 호출.

#### 5c. 통합 검증

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test -- --run
pnpm build

# Lighthouse mobile 빌드 산출물 — Hero 의 SVG mesh 가 무거운지
ls -la .next/static/chunks/ | grep -i hero
grep -rE "hero-mesh|HomeHero" .next/server/app/ 2>/dev/null | head -3
```

수동 smoke (선택, 사용자 PR 리뷰 시):
- `pnpm dev` → 홈 시각 확인 (Hero mesh 회전 60s, caret 깜빡임)
- 다크/라이트 토글 → mesh 색 자연 전환
- 모바일 (Chrome DevTools 360px) → Hero h1 폰트 줄어듦, dl 2 column
- `prefers-reduced-motion` 시뮬레이션 → mesh 정지 + caret 정지
- 글 상세에서 reading progress 그대로 동작 (plan011 보존)
- Header brand mark dot, mono nav 라벨 가독성

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 신규 컴포넌트
test -f src/components/HeroMesh.tsx
test -f src/components/HomeHero.tsx
grep -n "export function HeroMesh" src/components/HeroMesh.tsx
grep -n "export function HomeHero" src/components/HomeHero.tsx
grep -n "primaryHue" src/components/HeroMesh.tsx
grep -nE "postCount|categoryCount|lastUpdate" src/components/HomeHero.tsx | wc -l  # = 3

# 2) page.tsx 가 HomeHero 사용 + 기존 Hero Section 제거
grep -n "HomeHero" src/app/page.tsx
! grep -n "{/\* Hero Section \*/}" src/app/page.tsx
grep -n "getActivePostCount\|postCountTotal" src/app/page.tsx

# 3) Header — mono nav 라벨 + brand mark dot
grep -n '"01 / 홈"' src/components/Header.tsx
grep -n '"02 / 카테고리"' src/components/Header.tsx
grep -n "brand-mark" src/components/Header.tsx
grep -nE 'fos-blog' src/components/Header.tsx
! grep -nE "📚 FOS Study" src/components/Header.tsx

# 4) Header — 토큰 정렬 (기존 하드코딩 색 제거)
! grep -n "bg-white/80 dark:bg-gray-950/80" src/components/Header.tsx
! grep -n "text-blue-600 dark:text-blue-400" src/components/Header.tsx
grep -nE "var\(--color-(fg|bg|border|brand)" src/components/Header.tsx | head -5

# 5) globals.css 룰
grep -n "\.hero-mesh\b" src/app/globals.css
grep -n "@keyframes mesh-rotate-slow" src/app/globals.css
grep -n "\.hero-caret" src/app/globals.css
grep -n "@keyframes hero-caret-blink" src/app/globals.css
grep -n "prefers-reduced-motion" src/app/globals.css

# 6) plan011 reading progress 보존 (회귀 방지)
grep -n "isArticle" src/components/Header.tsx
grep -nE 'progress.*100' src/components/Header.tsx

# 7) repository 함수 (없으면 추가됐는지 확인)
grep -n "getActivePostCount" src/infra/db/repositories/*.ts | head -3

# 8) 빌드 + 회귀
pnpm test -- --run
pnpm lint
pnpm type-check
pnpm build

# 9) 금지사항
! grep -nE "as any" src/components/HeroMesh.tsx src/components/HomeHero.tsx src/components/Header.tsx
! grep -nE "console\.(log|warn|error)" src/components/HeroMesh.tsx src/components/HomeHero.tsx src/components/Header.tsx
! grep -nE "alert\(|confirm\(|prompt\(" src/components/HeroMesh.tsx src/components/HomeHero.tsx
```

## PHASE_BLOCKED 조건

- plan009 또는 plan011 미머지 (사전 게이트 1 실패) → **PHASE_BLOCKED: 선행 plan 필요**
- `post.getActivePostCount()` 추가했는데 Drizzle schema 의 `posts.isActive` 컬럼 없음 → **PHASE_BLOCKED: schema 확인 후 컬럼명 보정**
- Hero mesh SVG 가 빌드/Lighthouse Performance 점수 90 이하로 떨어뜨림 → **PHASE_BLOCKED: motion="off" 또는 정적 mesh 로 fallback** (작업 5a 의 globals.css 에서 `.hero-mesh--off` variant 활용)
- plan011 의 Header reading progress 통합과 충돌 (라인 17-33 이 깨짐) → **PHASE_BLOCKED: reading progress 보존 후 nav 변경만 적용**

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋:
- `feat(hero): add HeroMesh SVG with prefers-reduced-motion + slow rotate`
- `feat(home): add HomeHero with eyebrow + h1 caret + dl stats`
- `feat(header): mono nav labels + brand-mark dot + token alignment`
- `feat(repo): add getActivePostCount for HomeHero stats` (필요한 경우)
- `refactor(home): replace inline Hero Section with HomeHero component`
