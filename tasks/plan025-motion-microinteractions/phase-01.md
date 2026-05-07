# Phase 01 — CSS only 마이크로 인터랙션

**Model**: sonnet
**Goal**: 카드/링크/버튼의 미세한 motion polish. 라이브러리 추가 없이 Tailwind arbitrary values + plan009 motion 토큰만 사용.

> **실행 결과 (보수 노선 — 사용자 결정)**:
> - ✅ 카드 3종 (PostCard / CategoryCard / CategoryFeatured) 의 `duration-200 ease-out` → 토큰 (`var(--duration-default)` / `var(--ease-out)`) + `motion-reduce:transform-none motion-reduce:transition-none` variant 추가
> - ✅ button.tsx 에 `motion-reduce:transition-none motion-reduce:active:translate-y-0` 추가 (기존 `active:translate-y-px` 유지)
> - ✅ globals.css 에 `.link-draw` utility 정의 + `prefers-reduced-motion` 가드
> - ⏸ **보류 (회귀 위험)**: card `hover:shadow-[var(--shadow-popover)]` (border-color hover 일관성 유지), button `active:scale-[0.98]` (기존 translate-y 와 충돌), `.link-draw` 실제 적용 위치 (Header/ProfileCard 등 — 별도 plan 으로)
> - ⏸ **보류**: universal `prefers-reduced-motion` reset (`*,*::before,*::after { animation-duration: 0.01ms ... }`) — 기존 hero-mesh/hero-caret 개별 가드로 충분, universal reset 은 의도된 motion(스피너 등)도 차단할 위험

## Context (자기완결)

`src/app/globals.css` 에 plan009 motion 토큰 정의됨:
- `--duration-instant: 75ms`
- `--duration-fast: 150ms`
- `--duration-default: 250ms`
- `--duration-slow: 400ms`
- `--ease-out`, `--ease-spring`, `--ease-linear`
- `@media (prefers-reduced-motion: reduce)` 가드 일부 존재 (line 574, 592)

이번 phase 는 hover/focus 상태에 부드러운 transition 을 추가 — 사용자가 카드/링크/버튼과 상호작용 시 즉각 반응하지만 거칠지 않게.

## 작업 항목

### 1. PostCard / CategoryCard hover lift

대상: `src/components/PostCard.tsx`, `src/components/CategoryCard.tsx` (또는 `CategoryFeatured.tsx`)

추가 클래스 (각 카드 root):
```
transition-[transform,box-shadow] duration-[var(--duration-default)] ease-[var(--ease-out)]
hover:-translate-y-0.5 hover:shadow-[var(--shadow-popover)]
motion-reduce:transform-none motion-reduce:transition-none
```

`motion-reduce:` Tailwind variant 으로 `prefers-reduced-motion` 대응.

`shadow-popover` 토큰이 globals.css 에 정의됐는지 확인. 없으면 `--shadow-default` 또는 `--shadow-modal` 중 적절한 것 사용. 없으면 `hover:shadow-lg` 로 fallback.

### 2. Link underline draw

대상: 본문 link / nav link / 인라인 link 등 텍스트 링크. 글로벌 CSS 추가 (globals.css):

```css
@layer utilities {
  .link-draw {
    text-decoration-line: underline;
    text-decoration-color: transparent;
    text-underline-offset: 4px;
    text-decoration-thickness: 1px;
    transition: text-decoration-color var(--duration-fast) var(--ease-out);
  }
  .link-draw:hover {
    text-decoration-color: currentColor;
  }
  @media (prefers-reduced-motion: reduce) {
    .link-draw {
      transition: none;
    }
  }
}
```

적용 위치: 글 본문 `<a>` (prose 내부는 자동 스타일이 우선이라 충돌 가능 — prose 외 nav/card 내 link 위주로 적용). MarkdownRenderer 의 components.tsx 에서 `a` 컴포넌트가 정의돼 있으면 거기 className 에 `link-draw` 추가.

prose 외 적용 후보:
- Header nav links
- ProfileCard 의 GitHub 링크
- About 의 외부 링크

### 3. Button focus polish

기존 shadcn Button (`src/components/ui/button.tsx`) 의 focus ring 검토:
- `focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] focus-visible:ring-offset-2`
- transition 부드럽게: `transition-[box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)]`
- active state: `active:scale-[0.98]` (살짝 누름 효과)
- `motion-reduce:active:scale-100 motion-reduce:transition-none`

기존 변경 시 plan020/022 의 button 사용처에 영향. 시각 회귀 smoke 필요.

### 4. globals.css 의 prefers-reduced-motion 보강

기존 line 574, 592 의 가드 외에 신규 motion (위 1-3) 도 `@media (prefers-reduced-motion: reduce)` 분기로 비활성화. 위 작업 항목 1, 2 에 인라인으로 명시했지만 globals 에 한 번에 모아두는 게 유지보수 편함:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

이 universal reset 이 이미 있다면 변경 불필요. 없으면 globals.css 끝에 추가.

### 5. 검증

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

grep -n "link-draw" src/app/globals.css
grep -nE "hover:-translate-y" src/components/PostCard.tsx src/components/CategoryCard.tsx src/components/CategoryFeatured.tsx 2>&1
grep -n "motion-reduce" src/components/PostCard.tsx
```

수동 smoke:
- 마우스로 PostCard hover → 0.5px 위로 살짝 떠오름 + shadow 강화
- nav link hover → underline 그어짐 (4px offset)
- Button click → 살짝 누르는 느낌 (scale 0.98)
- macOS 시스템 환경설정 > 손쉬운 사용 > 동작 줄이기 ON 시 모든 motion 비활성

### 6. index.json status="completed" 마킹

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/components/PostCard.tsx` | 수정 (hover lift) |
| `src/components/CategoryCard.tsx` | 수정 (hover lift) |
| `src/components/CategoryFeatured.tsx` | 수정 (hover lift, 있다면) |
| `src/components/ui/button.tsx` | 수정 (active scale + transition) |
| `src/app/globals.css` | 수정 (link-draw utility + 필요시 reduced-motion universal reset) |

## Out of Scope

- motion-one / framer-motion 도입
- page transition (Next.js 16 view transitions API 도입)
- scroll-reveal 인터랙션
- 카드 entrance 애니메이션 (stagger fade-in)

## Risks

| 리스크 | 완화 |
|---|---|
| hover lift 가 모바일 (touch 디바이스) 에서 자연스럽지 않음 | `@media (hover: hover)` 가드 권장 — Tailwind v4 의 `hover:` 는 자동으로 hover 가능 디바이스에만 적용 (modern config). 추가 가드 불필요할 가능성 |
| 본문 prose 의 `a` 와 `link-draw` 충돌 | prose 외 영역에만 적용, prose 는 기존 typography 플러그인 스타일 유지 |
| Button active scale 이 form submit button 시각 깨짐 | 시각 smoke 시 PostCard / Header / Comments form 의 button 모두 확인 |
