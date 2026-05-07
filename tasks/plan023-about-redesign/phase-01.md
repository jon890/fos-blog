# Phase 01 — About 페이지 전면 리디자인

**Model**: sonnet
**Goal**: `/about` 페이지를 plan009 디자인 시스템 + plan016 sub-hero 패턴으로 재구성. GitHub 프로필 fetch 유지, 신규로 사이트 통계 카드 추가.

## Context (자기완결)

`src/app/about/page.tsx` 211줄, plan009 단절 (`text-gray-*`, `text-blue-*`, `bg-gray-*`, `border-gray-*` 전반). GitHub API fetch (`https://api.github.com/users/jon890`) 로 name/avatar/bio/repos/followers 받아 표시.

**플젝 컨벤션**:
- Server Component (`revalidate = 3600`) 유지
- `next/image` 로 avatar
- plan009 토큰만 사용 (`bg-[var(--color-bg-elevated)]`, `text-[var(--color-fg-primary|secondary|muted)]`, `border-[var(--color-border-subtle)]`, `text-[var(--color-brand-400)]`)
- container max-width: `1180px` (plan016 컨벤션과 정합)
- 하드코딩 색상 0줄 목표

## 작업 항목

### 1. `src/components/AboutSubHero.tsx` 신규

`PostsListSubHero` 와 같은 톤의 sub-hero. props:
- `eyebrow`: "ABOUT"
- `title`: "FOS Study" 또는 "fos-blog"
- `meta`: 한 줄 설명 (예: "한 명의 백엔드 엔지니어가 매일 쌓는 학습 노트")

레이아웃 동일 패턴:
```tsx
<div className="py-10 md:py-14">
  <div className="flex items-center gap-3">
    <span className="h-px w-6 bg-[var(--color-brand-400)]" />
    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-fg-muted)]">
      {eyebrow}
    </span>
  </div>
  <h1 className="mt-4 text-[28px] md:text-[40px] font-semibold leading-[1.1] tracking-tight text-[var(--color-fg-primary)]">
    {title}
  </h1>
  <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
    {meta}
  </p>
  <div className="mt-8 h-px bg-[var(--color-border-subtle)]" />
</div>
```

**결정 — 별도 컴포넌트 신규 (AboutSubHero.tsx)**: `PostsListSubHero` 의 `accent` prop 은 'popular' icon 전용으로 About 컨텍스트와 의미 불일치. 두 sub-hero 의 시각 패턴(eyebrow + title + meta + divider)은 유사하나 컨텍스트 분리가 명확. 향후 다른 페이지 (e.g. /tags) 에 sub-hero 가 더 추가될 때 공통화 검토 (별도 plan).

### 2. `src/components/about/ProfileCard.tsx` 신규

기존 GitHub 프로필 카드 영역 분리. props:
- `name`, `bio`, `avatarUrl`, `htmlUrl`, `publicRepos`, `followers`

레이아웃:
- 좌: `next/image` avatar 96~128px, rounded-full, `border border-[var(--color-border-subtle)]`
- 우: name (h1, fg-primary), bio (fg-secondary), 통계 (`{publicRepos} repos · {followers} followers` — fg-muted), GitHub 링크 (brand-400)
- 컨테이너: `bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[12px] p-6 md:p-8`

### 3. `src/components/about/SiteStats.tsx` 신규

신규 카드 — 블로그 사이트 통계.

데이터:
- 총 글 수 (`postCount`): `getRepositories().post.countActive()` 또는 기존 helper
- 카테고리 수 (`categoryCount`): `categoryIcons` 키 개수 또는 distinct query
- 최근 sync 시점 (`lastSyncAt`): 가장 최근 `posts.updatedAt` MAX

**구현 노트**:
- About 페이지 자체가 server component 라 `getRepositories()` 직접 호출 가능
- 통계 fetch 함수 1개 신규 (`getAboutStats()` in `src/services/StatsService.ts`) — 구조 일관성 위해 service 분리 필수
- **Service factory 등록 필수**: `src/services/index.ts` 에 `createStatsService()` factory 함수 추가하여 기존 DI 패턴 일치 유지 (다른 service 와 동일하게)
- 빈 DB 상태 fallback: `0 / 0 / 동기화 전`

레이아웃:
- 3 column grid (`grid grid-cols-3 gap-4`), 각 cell:
  - eyebrow (font-mono uppercase 11px fg-muted): `POSTS` / `CATEGORIES` / `LAST SYNC`
  - 큰 숫자 (semibold 32px fg-primary): `218`, `9`, `2시간 전` (`formatRelativeTime` from `@/lib/format-time` — plan022 에서 추가, `Date | string` 양쪽 수용)
  - 컨테이너: `bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[12px] p-5`

### 4. `src/components/about/StackGrid.tsx` 신규

기술 스택 정리 (현재 inline 으로 있는 부분을 카드 grid 로):

```tsx
const STACK_ITEMS = [
  { label: "Next.js", category: "react" },
  { label: "TypeScript", category: "js" },
  { label: "MySQL", category: "db" },
  { label: "Drizzle ORM", category: "db" },
  { label: "Tailwind CSS", category: "react" },
  { label: "Docker", category: "devops" },
  // ... 기존 about/page.tsx 의 스택 목록 그대로
];
```

각 카드:
- chip `bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-[8px] px-3 py-2`
- 작은 dot `h-1.5 w-1.5 rounded-full` 카테고리별 색 (plan022 Avatar 의 `CAT_HEX_PALETTE` 와 일관)
- 텍스트 `text-[var(--color-fg-secondary)] text-sm`

grid: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3`

### 5. `src/app/about/page.tsx` 통합

기존 page.tsx 를 컨테이너로 단순화 — section 구성:
1. `<AboutSubHero ... />` (또는 PostsListSubHero 재사용)
2. `<ProfileCard ... />` — GitHub fetch 결과 전달
3. `<SiteStats ... />` — 사이트 통계 fetch 결과 전달
4. `<StackGrid />`
5. 링크 섹션 (GitHub / 블로그 / 이메일 등): `LinksGrid.tsx` 신규 또는 inline — 4번과 같은 chip 패턴

container: `<div className="container mx-auto max-w-[1180px] px-4 py-12 md:py-16">`

각 section 사이 `mt-12 md:mt-16`.

기존 metadata 객체는 그대로 유지.

### 6. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 잔존 하드코딩 색 0줄 (about 영역 전체)
! grep -nE "bg-white|bg-gray-|bg-blue-|text-gray-|text-blue-|text-white|border-gray-|focus:ring-blue" src/app/about/page.tsx src/components/about/

# 신규 컴포넌트
test -d src/components/about
test -f src/components/about/ProfileCard.tsx
test -f src/components/about/SiteStats.tsx
test -f src/components/about/StackGrid.tsx

# stats service (있다면)
test -f src/services/StatsService.ts || grep -n "getAboutStats" src/app/about/page.tsx
```

수동 smoke (사용자 안내):
- `pnpm dev` → `/about` 진입 → 다크/라이트 모드 양쪽 시각 확인
- GitHub fetch 실패 시 fallback (try/catch 의 catch 분기) 동작
- 통계 카드의 숫자가 실제 DB 와 일치 (총 글 수)

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/components/about/ProfileCard.tsx` | 신규 |
| `src/components/about/SiteStats.tsx` | 신규 |
| `src/components/about/StackGrid.tsx` | 신규 |
| `src/components/about/LinksGrid.tsx` (선택) | 신규 또는 inline |
| `src/services/StatsService.ts` (선택) | 신규 |
| `src/app/about/page.tsx` | 대폭 수정 |

## Out of Scope

- Claude Design mockup 도착 시 layout 미세조정은 후속 review-fix 또는 별도 plan
- 다국어 about (i18n)
- About 의 OG 이미지 별도 생성 (현재 layout.tsx 의 default OG 사용)

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| GitHub API rate limit | **인증 요청 필수** — `Authorization: Bearer ${process.env.GITHUB_TOKEN}` 헤더 사용 (5000/hour, 미인증 60/hour 의 ~83x). `revalidate = 3600` 은 보조 캐시 역할. 다중 컨테이너 재시작 / CDN 무효화 동시 fetch 시에도 한도 여유. ProfileCard fetch 구현: `fetch("https://api.github.com/users/jon890", { headers: { Authorization: \`Bearer ${process.env.GITHUB_TOKEN}\` }, next: { revalidate: 3600 } })` |
| countActive 가 기존 repository 에 없음 | 있으면 그대로, 없으면 `db.select({ count: sql<number>\`count(*)\` }).from(posts).where(eq(posts.isActive, true))` inline 또는 service 추가 |
| Stack 목록이 about/page.tsx 에 inline 으로 박혀 있어 중복 위험 | StackGrid 내부에 상수로 두고 about/page.tsx 에서는 import 만 — 단일 소스 |
