# Phase 01 — 홈 hero 정적 SVG mesh 그라디언트

**Model**: sonnet
**Goal**: `HomeHero` 배경에 plan009 mesh-stop 6색 기반 정적 SVG mesh blob 추가. 텍스트 가독성 유지, 다크/라이트 양쪽 동작.

## Context (자기완결)

`src/app/globals.css` 의 `:root` 에 mesh-stop 6 토큰 정의 (plan009 에서 정의됨):
- `--mesh-stop-01` blue (230)
- `--mesh-stop-02` cyan (195)
- `--mesh-stop-03` violet (280)
- `--mesh-stop-04` indigo (250)
- `--mesh-stop-05` teal (175)
- `--mesh-stop-06` magenta (305)

**제약**:
- oklch 사용 가능 (브라우저 native CSS — satori 가 아닌 일반 렌더)
- mesh gradient 는 native CSS 미지원 → SVG `<radialGradient>` 6개 + 큰 `<circle>` 또는 `<ellipse>` blob 으로 시뮬레이션
- 텍스트 위 가독성: blob 위에 `bg-[var(--color-bg-base)]/60 backdrop-blur-sm` 오버레이 또는 SVG opacity 0.3~0.5

## 작업 항목

### 1. `src/components/HeroMesh.tsx` 신규

inline SVG (Server Component OK, "use client" 불필요):

```tsx
export function HeroMesh() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full -z-10 opacity-60"
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="mesh-01" cx="20%" cy="30%" r="40%">
          <stop offset="0%" stopColor="oklch(0.7 0.16 230)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="oklch(0.7 0.16 230)" stopOpacity="0" />
        </radialGradient>
        {/* 02 cyan, 03 violet, 04 indigo, 05 teal, 06 magenta — 위치 cx/cy/r 각각 다르게 */}
      </defs>
      <rect width="100%" height="100%" fill="var(--color-bg-base)" />
      <rect width="100%" height="100%" fill="url(#mesh-01)" />
      <rect width="100%" height="100%" fill="url(#mesh-02)" />
      {/* 6개 layer */}
    </svg>
  );
}
```

각 mesh-stop 의 cx/cy/r 배치 (시각 구성 가이드):
- 01 blue: 좌상단 20%/25%, r 35%
- 02 cyan: 우상단 80%/20%, r 30%
- 03 violet: 좌하단 25%/75%, r 30%
- 04 indigo: 중앙 50%/50%, r 25%
- 05 teal: 우하단 75%/80%, r 35%
- 06 magenta: 좌중간 15%/55%, r 20%

oklch 값은 globals.css 토큰과 동일하게 직접 박아 넣음 (CSS variable 을 SVG `stop-color` 에 안정적으로 적용 어려움 — 일부 구형 webkit). 향후 리팩토링 가능.

`opacity-60` 은 다크/라이트 양쪽 가독성 검토 후 조정 (다크는 60%, 라이트는 30~40% 가 적절할 가능성).

### 2. `src/components/HomeHero.tsx` 통합

기존 hero 의 outer wrapper 를 `relative` 로 변경 후 `<HeroMesh />` 를 첫 번째 자식으로 삽입:

```tsx
<section className="relative ...">
  <HeroMesh />
  <div className="relative z-10 ...">
    {/* 기존 텍스트 컨텐츠 */}
  </div>
</section>
```

기존 hero 디자인 (텍스트, 버튼) 변경 없음. mesh 만 추가.

### 3. 라이트/다크 mesh 가시성 조정 (선택)

light mode 에서 mesh 가 너무 진하면 `dark:opacity-60` / `opacity-30` 로 분기. 시각 검증 후 결정.

또는 `bg-[var(--color-bg-base)]` 위에 mesh 가 얹히는 구조라 자동 조화 가능 — 1차 구현 후 smoke 로 확인.

### 4. 검증

```bash
pnpm lint
pnpm type-check
pnpm build

test -f src/components/HeroMesh.tsx
grep -n "HeroMesh" src/components/HomeHero.tsx

# Lighthouse Performance 90 이상 유지 (CI 에서 자동) — SVG inline 이라 LCP 영향 미미
```

수동 smoke:
- 홈 페이지 다크/라이트 양쪽 시각 (텍스트 가독성 + mesh 색감)
- 모바일 (375px) 에서 viewBox slice 가 자연스러운지

### 5. index.json status="completed" 마킹

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/components/HeroMesh.tsx` | 신규 |
| `src/components/HomeHero.tsx` | 수정 (relative wrapper + HeroMesh 삽입) |

## Out of Scope

- 애니메이션 (사용자 결정: 정적)
- 다른 페이지 sub-hero 적용 — 홈만
- mesh 위치/색 디자이너 검토 — 1차는 위 가이드값 적용

## Risks

| 리스크 | 완화 |
|---|---|
| oklch SVG stop-color 일부 구형 브라우저 미지원 | Tailwind v4 / Next.js 16 대상 브라우저는 oklch 지원. 미지원 시 sRGB hex fallback (별도 plan 으로 회귀 시) |
| mesh 위 텍스트 가독성 저하 | `opacity-60` / `opacity-30` 조정 + 필요시 텍스트 영역에 `bg-[var(--color-bg-base)]/40 backdrop-blur-sm` 패치 |
| LCP 영향 | inline SVG ~3KB, no network — 영향 미미. CI Lighthouse 자동 차단 |
