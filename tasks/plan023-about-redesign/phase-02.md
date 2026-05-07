# Phase 02 — 자동 검증 + docs 생성 + 마킹

**Model**: haiku
**Goal**: phase-01 결과의 자동 게이트 검증 + `docs/pages/about.md` 신규 + index.json 마킹.

## 작업 항목

### 1. 자동 게이트 (필수 — 모두 통과해야 phase 종료)

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 신규 파일 존재
test -f src/app/about/about.css
test -f src/components/about/ProfileCard.tsx
test -f src/components/about/SiteStats.tsx
test -f src/components/about/StackGrid.tsx
test -f src/components/about/LinksGrid.tsx
test -f src/services/StatsService.ts
test -f src/services/StatsService.test.ts

# 하드코딩 색 0줄 (about 영역)
! grep -nE "bg-white|bg-gray-|bg-blue-|text-gray-|text-blue-|text-white|border-gray-|focus:ring-blue|#[0-9a-fA-F]{3,6}\b" src/app/about/page.tsx src/components/about/*.tsx
# about.css 는 plan009 var + oklch 만 (raw hex 0건)
! grep -nE "#[0-9a-fA-F]{3,6}\b" src/app/about/about.css

# Service factory 등록
grep -n "createStatsService" src/services/index.ts

# lucide 아이콘 사용 (mockup 인라인 SVG 가 아닌)
grep -n 'from "lucide-react"' src/components/about/LinksGrid.tsx

# RSS / Newsletter / X 링크 부재 (실 데이터만)
! grep -nE "rss\.xml|newsletter|twitter" src/components/about/LinksGrid.tsx

# Vercel / MDX / Redis 부재 (mockup placeholder 제거)
! grep -nE "Vercel|\bMDX\b|Redis" src/components/about/StackGrid.tsx

# GitHub fetch 인증 헤더 추가 확인
grep -n "Authorization.*GITHUB_TOKEN" src/app/about/page.tsx
```

### 2. `docs/pages/about.md` 신규

3~5줄 짧게 — 컴포넌트 분리 + 데이터 소스만:
- 컴포넌트: `ProfileCard` (GitHub API, 인증 헤더 + revalidate=3600), `SiteStats` (StatsService), `StackGrid` / `LinksGrid` (정적)
- container 1180px max-width, plan009 토큰 + numbered 섹션 헤더
- CSS: co-located `src/app/about/about.css` (Tailwind arbitrary 만으로 어색한 ::after hairline / @keyframes / oklch dynamic chip color 처리)
- 데이터: `categoryCount = COUNT(DISTINCT posts.category WHERE isActive)`, `lastSyncAt = MAX(posts.updatedAt)`

### 3. index.json status 마킹

`tasks/plan023-about-redesign/index.json` 의 phase 1/2 + 최상위 `status` = `"completed"`.

### 4. 마킹 검증

```bash
test -f docs/pages/about.md
[ "$(jq -r '.status' tasks/plan023-about-redesign/index.json)" = "completed" ]
[ "$(jq -r '[.phases[] | select(.status=="completed")] | length' tasks/plan023-about-redesign/index.json)" = "2" ]
```

## 수동 smoke (참고 — 자동 게이트 통과 후 사용자가 별도 확인)

- `pnpm dev` → `/about` 진입 → 다크/라이트 모드 양쪽에서 mockup 과 1:1 비교
- pulse 애니메이션 (LAST SYNC 카드) 동작
- chip hover transition (`translateY(-1px)` + border-color 변화)
- LinksGrid hover 시 brand-400 으로 color shift + dot 발광
- GitHub avatar 정상 로드 (이니셜이 사진 뒤에 가려져 있으면 OK)
