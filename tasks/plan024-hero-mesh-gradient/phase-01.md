# Phase 01 — 홈 hero SVG mesh 그라디언트

**Model**: sonnet
**Goal**: `HomeHero` 배경에 plan009 mesh-stop 토큰 기반 SVG mesh blob 추가. 텍스트 가독성 유지, 다크/라이트 양쪽 동작.

> **상태 메모**: 본 phase 결과물은 PR #81 (`feat(hero): add HeroMesh — SVG radialGradient + slow rotate`) + PR review fix (`e02d283`) 로 main 에 머지되어 있다. 본 task 는 사후 정리(spec 문서화) 용도. 본 spec 은 main 의 실제 구현(`src/components/HeroMesh.tsx`)을 기록한 것.

## Context (자기완결)

`src/app/globals.css` `:root` 의 mesh-stop 6 토큰 (plan009):
- `--mesh-stop-01` blue (230) ~ `--mesh-stop-06` magenta (305)

**제약**:
- mesh gradient 는 native CSS 미지원 → SVG `<radialGradient>` blob 으로 시뮬레이션
- SVG presentation attribute(`stopColor=`) 는 `var()` 해석 안 됨 → inline `style` 로 전달 필요
- 다크/라이트 가독성: `.hero-mesh` 컨테이너 + globals.css 의 layer opacity 조절

## 실제 구현 요약

### 1. `src/components/HeroMesh.tsx`

서버 컴포넌트. `primaryHue` (degrees) + `motion` (`"default" | "subtle" | "off"`) props 노출:

- `primaryHue` 기본 195 (brand cyan). 카테고리/페이지별 변형 시 활용
- `motion` 기본 `"default"` — `prefers-reduced-motion` 은 globals.css `.hero-mesh--no-motion` / `@media (prefers-reduced-motion)` 로 자동 처리

3-layer SVG:
- `mesh-stop-1`: `oklch(0.7 0.16 var(--mesh-primary-hue))` 가변 hue, opacity 0.55, cx/cy 20%/30% r 60%
- `mesh-stop-2`: `var(--mesh-stop-03)` violet, opacity 0.4, cx/cy 80%/35% r 55%
- `mesh-stop-3`: `var(--mesh-stop-02)` cyan, opacity 0.45, cx/cy 50%/80% r 60%

> spec 초안은 6-layer 정적 mesh 였지만 실제 구현은 3-layer + 회전 애니메이션 + props 기반 hue 가변 으로 풍부하게 발전. UX 검증 후 결정된 형태.

### 2. `src/components/HomeHero.tsx`

`<HeroMesh primaryHue={195} />` 를 hero 의 첫 자식으로 삽입. 기존 텍스트/버튼 디자인 유지. wrapper 는 `relative overflow-hidden`.

### 3. `src/app/globals.css`

`.hero-mesh`, `.hero-mesh-svg`, `.mesh-layer`, 회전 keyframes (`mesh-rotate-slow` 60s/90s reverse) + `prefers-reduced-motion` fallback 정의. 다크/라이트 분기는 토큰(`--mesh-stop-*`) 으로 자연 조화.

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/components/HeroMesh.tsx` | 신규 (PR #81) |
| `src/components/HomeHero.tsx` | 수정 — `<HeroMesh primaryHue={195} />` 삽입 |
| `src/app/globals.css` | `.hero-mesh*` + keyframes 정의 |

## Out of Scope

- 다른 페이지 sub-hero 적용 (홈만)
- mesh 색/위치 디자이너 검토 — 1차 가이드값 적용 후 review fix 로 미세 조정 완료

## Risks (이력)

| 리스크 | 대응 |
|---|---|
| oklch SVG `stopColor=` 의 var() 미해석 | inline `style={{ stopColor: "..." }}` 로 우회 (review fix 적용) |
| 모션 멀미 | `prefers-reduced-motion` + `motion="off"` props |
| LCP 영향 | inline SVG (~1KB), no network — Lighthouse 영향 미미 |
