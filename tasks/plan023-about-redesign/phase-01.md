# Phase 01 — About 페이지 전면 리디자인 (Claude Design mockup 반영)

**Model**: sonnet
**Goal**: `/about` 페이지를 Claude Design mockup (`tasks/plan023-about-redesign/design-about.{css,jsx}`) 의 시각 사양 그대로 재구성. plan009 토큰 + plan016 sub-hero 패턴 유지. GitHub 프로필 fetch + DB 사이트 통계 양쪽 통합.

## 시각 레퍼런스 (필수 — 구현 전 반드시 읽기)

- `tasks/plan023-about-redesign/design-about.jsx` — 마크업 구조 + 데이터 형태
- `tasks/plan023-about-redesign/design-about.css` — 정확한 spec (간격, 폰트 크기, transition, keyframe)

mockup 의 짧은 토큰명을 plan009 토큰으로 일괄 치환:

| mockup | plan009 |
|---|---|
| `var(--bg-base)` | `var(--color-bg-base)` |
| `var(--bg-elevated)` | `var(--color-bg-elevated)` |
| `var(--bg-overlay)` | `var(--color-bg-overlay)` |
| `var(--fg-primary)` | `var(--color-fg-primary)` |
| `var(--fg-secondary)` | `var(--color-fg-secondary)` |
| `var(--fg-muted)` | `var(--color-fg-muted)` |
| `var(--fg-faint)` | `var(--color-fg-faint)` |
| `var(--border-subtle)` | `var(--color-border-subtle)` |
| `var(--border-default)` | `var(--color-border-default)` |
| `var(--brand)` | `var(--color-brand-400)` |

## 프로젝트 환경 (사전 확인 완료)

- `lucide-react@^0.469.0` 설치됨 → `Github`, `Code`, `Mail` 아이콘 import 사용 (mockup 의 inline SVG 대신)
- `next.config.ts` 의 `images.remotePatterns` 에 `avatars.githubusercontent.com` 이미 등록됨 → 추가 작업 없음
- `formatRelativeTime` 은 `@/lib/format-time` 존재 (plan022)
- RSS 라우트 부재 → LinksGrid 에서 제외 (Newsletter / X 도 미구현이라 제외)
- `LICENSE` 파일 부재 → footer 에 "MIT" 문구 금지 (단순 `© ${year} jon890`)

## 데이터 정합 (mockup placeholder → 실 데이터)

mockup 의 가짜 통계/리스트는 실제 fos-blog 값으로 치환:

- **STACK 리스트** (mockup 의 "Vercel / MDX / Redis" 는 본 프로젝트 무관 — 실 스택만):
  ```ts
  const STACK = [
    { label: "Next.js 16",         hue: 0,   key: "framework" },
    { label: "TypeScript",         hue: 220, key: "language" },
    { label: "Tailwind v4",        hue: 195, key: "styling" },
    { label: "Drizzle ORM",        hue: 90,  key: "data" },
    { label: "MySQL 8",            hue: 55,  key: "db" },
    { label: "Docker",             hue: 230, key: "infra" },
    { label: "Octokit",            hue: 145, key: "github" },
    { label: "rehype-pretty-code", hue: 250, key: "syntax" },
    { label: "mermaid",            hue: 175, key: "diagram" },
    { label: "Vitest",             hue: 120, key: "test" },
    { label: "pino",               hue: 35,  key: "log" },
    { label: "shadcn/ui",          hue: 280, key: "ui" },
  ] as const;
  ```
- **LINKS** (실재하는 링크만):
  ```ts
  const LINKS = [
    { ttl: "GitHub",  sub: "@jon890",          href: "https://github.com/jon890",            ico: Github },
    { ttl: "Source",  sub: "jon890/fos-blog",  href: "https://github.com/jon890/fos-blog",   ico: Code },
    { ttl: "Content", sub: "jon890/fos-study", href: "https://github.com/jon890/fos-study",  ico: Code },
  ] as const;
  ```
- **ProfileCard 통계**: GitHub API 의 `public_repos`, `followers` 두 개만 (mockup 의 `7y writing` 같은 임의값 제거)
- **SiteStats**: 실 DB 조회 값 (schema 확인: `posts.category` (varchar notnull), `posts.subcategory` (nullable), `posts.folders` (json array). `categoryPath` 컬럼은 없음)
  - `POSTS .total`: `posts.isActive=true` count
  - `CATEGORIES .active`: `COUNT(DISTINCT category) WHERE isActive=true` (단순. sub 라인 `"distinct category"`)
  - `LAST SYNC .db`: `MAX(posts.updatedAt)` → `formatRelativeTime`. null 이면 큰 숫자 영역에 `—`, sub 라인에 `no sync yet`

## 컨벤션 / 기술 결정

- **Server Component** (`revalidate = 3600`) 유지
- **Avatar 두 상태는 디자인의 일부** — mockup 의 gradient + 이니셜 컨테이너는 항상 렌더링되며, GitHub 프로필 fetch 가 성공하면 그 위에 `next/image` 가 채워진다. fetch 실패 / `avatarUrl` 부재 시 이니셜이 그대로 보이는 구조.
  - `.ab-avatar` 컨테이너에 radial gradient + initial 텍스트는 항상 존재
  - `next/image` 는 `.ab-avatar` 자식으로 absolute 배치 (mockup `position: relative` 컨테이너 활용)
- **CSS 전략**: `::before`/`::after` hairline, `@keyframes ab-pulse`, `oklch(... ${hue})` 동적 색은 Tailwind arbitrary value 만으로 어색 → **`src/app/about/about.css` co-located CSS 파일** 신규 + `import "./about.css"` 로 page.tsx 에 주입. 클래스 prefix `ab-` 유지 (mockup 과 1:1 비교 용이).
  - mockup 의 `.ab-shell.light { ... }` 토큰 재정의 블록은 제거 (plan009 가 `:root` (default = dark) / `:root:not(.dark)` (light override) 로 이미 처리. `[data-theme]` selector 도입 금지)
  - mockup 의 `.ab-shell.mobile` 클래스 분기는 `@media (max-width: 640px)` 로 변환 (page.tsx 가 `mobile` prop 안 넘김)
  - `--cat-color` 인라인 변수 패턴은 유지 (chip dot 색)
- container max-width 1180px, padding `0 32px` (모바일 `0 20px`)
- **하드코딩 색 0줄** — `#`, `rgb(...)`, `text-gray-*`, `bg-blue-*` 등 0건. 단 `oklch(0.74 0.09 ${hue})` 인라인 `--cat-color` 는 디자인 의도라 허용
- **GitHub API**: `Authorization: Bearer ${process.env.GITHUB_TOKEN}` 헤더 + `next: { revalidate: 3600 }`. 인증 시 한도 5000/hour. 본 프로젝트 모든 GitHub fetch 와 동일한 패턴.

## 작업 항목

### 1. `src/app/about/about.css` 신규

`tasks/plan023-about-redesign/design-about.css` 를 베이스로 위 토큰 매핑 표대로 일괄 치환. 변경 사항:
- `.ab-shell.light { ... }` 블록 제거 (plan009 의 `:root:not(.dark)` 가 처리)
- `.ab-shell.mobile ...` 분기를 `@media (max-width: 640px) { ... }` 로 변환
- 모든 색은 plan009 변수 직접 참조
- `@keyframes ab-pulse` 그대로 유지
- **신규 룰 추가** (mockup 에 부재 — `next/image` 자식 배치용):
  ```css
  .ab-avatar-initial { position: relative; z-index: 0; }
  .ab-avatar-img { position: absolute; inset: 0; object-fit: cover; z-index: 1; border-radius: inherit; }
  ```
  `.ab-avatar` 의 grid + font 룰은 그대로 두고 (이니셜 위치 잡이용), 사진은 `inset:0` 으로 이니셜을 덮음.

### 2. `src/services/StatsService.ts` + 테스트 + factory 등록

```ts
export interface SiteStats {
  postCount: number;
  categoryCount: number;
  lastSyncAt: Date | null;
}

export function createStatsService(repos: Repositories) {
  return {
    async getAboutStats(): Promise<SiteStats> {
      // posts.isActive=true count, distinct categoryPath count, MAX(updatedAt)
    },
  };
}
```

- DB 조회 3개 쿼리 (드리즐). 빈 DB → `{ postCount: 0, categoryCount: 0, lastSyncAt: null }`.
- `src/services/index.ts` 에 factory 등록 (기존 PostService 패턴 그대로)
- `src/services/StatsService.test.ts`: vitest mock repositories — 빈 결과 / 정상 결과 두 케이스

### 3. `src/components/about/ProfileCard.tsx` 신규

mockup `.ab-profile` 그대로. props: `name`, `handle`, `bio`, `avatarUrl`, `htmlUrl`, `publicRepos`, `followers`.

```tsx
<article className="ab-card ab-profile">
  <div className="ab-avatar">
    <span className="ab-avatar-initial">{name.charAt(0).toUpperCase()}</span>
    {avatarUrl && (
      <Image src={avatarUrl} alt={name} fill sizes="128px" className="ab-avatar-img" />
    )}
  </div>
  <div className="ab-profile-body">
    <h2 className="ab-profile-name">
      {name}<span className="handle">{handle}</span>
    </h2>
    <p className="ab-profile-bio">{bio}</p>
    <div className="ab-profile-stats">
      <span className="stat"><span className="num">{publicRepos}</span><span className="lbl">repos</span></span>
      <span className="stat"><span className="num">{followers}</span><span className="lbl">followers</span></span>
    </div>
    <a className="ab-profile-cta" href={htmlUrl} target="_blank" rel="noopener noreferrer">
      <span>{htmlUrl.replace(/^https?:\/\//, "")}</span>
      <span className="arr">↗</span>
    </a>
  </div>
</article>
```

`.ab-avatar-img` 는 `position: absolute; inset: 0;` 로 이니셜 위에 덮음. `avatarUrl` 없으면 이니셜만 보임 (디자인 명시 상태).

### 4. `src/components/about/SiteStats.tsx` 신규

3-card grid. props: `{ postCount, categoryCount, lastSyncAt }`.

```tsx
<div className="ab-stats">
  <div className="ab-card ab-stat">
    <div className="ab-stat-eyebrow"><span>POSTS</span><span className="right">total</span></div>
    <div className="ab-stat-num">{postCount}<span className="unit">posts</span></div>
    <div className="ab-stat-sub">{categoryCount} categories</div>
  </div>
  <div className="ab-card ab-stat">
    <div className="ab-stat-eyebrow"><span>CATEGORIES</span><span className="right">active</span></div>
    <div className="ab-stat-num">{categoryCount}<span className="unit">paths</span></div>
    <div className="ab-stat-sub">distinct category</div>
  </div>
  <div className="ab-card ab-stat">
    <div className="ab-stat-eyebrow"><span>LAST SYNC</span><span className="right">db</span></div>
    <div className="ab-stat-num">
      {lastSyncAt ? formatRelativeTime(lastSyncAt) : "—"}
    </div>
    <div className="ab-stat-sub">
      <span className="pulse" />
      <span>{lastSyncAt ? new Date(lastSyncAt).toISOString().slice(0, 10) : "no sync yet"}</span>
    </div>
  </div>
</div>
```

### 5. `src/components/about/{StackGrid,LinksGrid}.tsx` + `src/app/about/page.tsx` 통합

**StackGrid**: 위 STACK 상수, mockup chip 패턴:
```tsx
<span className="ab-chip" style={{ "--cat-color": `oklch(0.74 0.09 ${s.hue})` } as React.CSSProperties}>
  <span className="dot" />
  <span className="ab-chip-label">{s.label}</span>
  <span className="key">{s.key}</span>
</span>
```
`.ab-chip-label` 의 ellipsis truncation 은 about.css 에서 처리.

**LinksGrid**: 위 LINKS, lucide 아이콘:
```tsx
<a className="ab-chip link" href={l.href} target="_blank" rel="noopener noreferrer">
  <span className="ico"><l.ico size={16} /></span>
  <span className="ab-chip-link-body">
    <span className="ttl">{l.ttl}</span>
    <span className="sub">{l.sub}</span>
  </span>
  <span className="key">↗</span>
</a>
```

**`fetchGitHubProfile()` 추출 + 인증 헤더 추가** (현 `src/app/about/page.tsx:48` 의 함수가 unauthenticated 60/h 한계 → 5000/h 로):
```ts
async function fetchGitHubProfile() {
  const res = await fetch("https://api.github.com/users/jon890", {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}` },
    next: { revalidate: 3600 },
  });
  // ...
}
```
`env` 는 `@/env` 에서 import (이미 `GITHUB_TOKEN` required 등록됨).

**`page.tsx` 통합** (Server Component):

```tsx
import "./about.css";

export const revalidate = 3600;

export default async function AboutPage() {
  const profile = await fetchGitHubProfile();
  const stats = await createStatsService(getRepositories()).getAboutStats();

  return (
    <div className="ab-shell">
      <header className="ab-subhero">
        <div className="ab-container">
          <span className="ab-eyebrow">ABOUT</span>
          <h1 className="ab-title">FOS Study</h1>
          <p className="ab-meta">
            한 명의 백엔드 엔지니어가 매일 쌓는 학습 노트.
            공부하면서 기록하고, 기록하면서 다시 배웁니다.
          </p>
        </div>
      </header>
      <main className="ab-container">
        <Section idx="01" label="profile">
          <ProfileCard {...profile} />
        </Section>
        <Section idx="02" label="site stats" right="snapshot">
          <SiteStats {...stats} />
        </Section>
        <Section idx="03" label="stack" right={`${STACK.length} packages`}>
          <StackGrid />
        </Section>
        <Section idx="04" label="links" right="external">
          <LinksGrid />
        </Section>
        <div className="ab-end">
          <span>fos-blog · /about</span>
          <span>© {new Date().getFullYear()} jon890</span>
        </div>
      </main>
    </div>
  );
}
```

`<Section>` 은 page.tsx 안의 helper (별도 component 분리 X). `fetchGitHubProfile()` 는 기존 about/page.tsx 에 이미 있는 fetch 로직을 함수 추출 (인증 헤더 + revalidate=3600). 메타데이터 객체는 그대로 유지.

> **검증/lint/build 게이트는 phase-02 로 통합** — phase-02 의 verification 섹션 참조. phase-01 은 코드 작성에 집중.

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/app/about/about.css` | 신규 |
| `src/app/about/page.tsx` | 대폭 수정 |
| `src/components/about/ProfileCard.tsx` | 신규 |
| `src/components/about/SiteStats.tsx` | 신규 |
| `src/components/about/StackGrid.tsx` | 신규 |
| `src/components/about/LinksGrid.tsx` | 신규 |
| `src/services/StatsService.ts` | 신규 |
| `src/services/StatsService.test.ts` | 신규 |
| `src/services/index.ts` | factory 추가 |

## Out of Scope

- About 의 OG 이미지 별도 생성 (현재 layout.tsx 의 default OG 사용)
- 다국어 about (i18n)
- Newsletter / X / RSS 링크 (모두 미구현)
- mockup 의 "3 are draft-only", "main · #a3f9c1" 같은 가짜 메타

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| GitHub API 일시 장애 | 인증 헤더 + revalidate=3600. 디자인 자체가 이니셜 컨테이너를 항상 렌더하고 그 위에 사진을 덮는 구조라 사진 누락 시 그래픽 깨짐 없음 |
| `next/image` 의 fill + relative parent | `.ab-avatar` 가 `position: relative`, `next/image` 가 `position: absolute; inset: 0`. mockup 의 컨테이너 spec 그대로 |
| `oklch(... ${hue})` 카테고리 색이 양쪽 모드에서 채도 차이 | mockup 채도 0.09 가 양쪽에서 충분히 분간 가능 (plan009 categoryIcons 와 일관) |
| `formatRelativeTime` null 처리 | `lastSyncAt === null` 분기 명시. plan022 helper 가 `Date | string` 양쪽 수용하므로 null 만 추가 가드 |
