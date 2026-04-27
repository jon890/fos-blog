# Phase 01 — tokens + Geist/Pretendard 폰트 + shadcn init + Button + 검증

## 컨텍스트 (자기완결 프롬프트)

ADR-017 의 디자인 시스템 결정에 따라 Claude Design 토큰 mockup 결과를 fos-blog 코드에 1차 적용. 시각 영향은 최소(기존 컴포넌트가 토큰 변수를 직접 참조하지 않으므로 폰트만 변경됨), 후속 plan (plan010 컴포넌트 리디자인) 의 기반을 깐다.

승인된 Plan: `/Users/nhn/.claude/plans/hidden-moseying-charm.md` (사용자 ExitPlanMode 승인 완료)

### 현재 baseline (이 phase 가 변경할 대상)

`src/app/globals.css` 현재 구조:
- `@import "tailwindcss"` + `@source` 2 줄 (`./app/**`, `../components/**`)
- `@variant dark (&:where(.dark, .dark *))` — `.dark` 클래스 기반 dark 토글
- `@theme` 블록의 4 변수: `--color-background`, `--color-foreground`, `--color-primary`, `--color-primary-dark`
- `.dark { --color-background: #0a0a0a; --color-foreground: #ededed; }` 별도 블록 — dark override
- `body { font-family: var(--font-sans), "Noto Sans KR", ... }` — fallback chain
- 기존 `.category-{architecture,database,javascript,default,...}` 9 클래스 (Tailwind `@apply` 패턴)
- `prose`, `scrollbar`, `animate-fade-in` 정의 (그대로 유지)

`src/app/layout.tsx` 현재:
- `next/font/google` 의 `Noto_Sans_KR`, `JetBrains_Mono` import (line 1-4 부근)
- `notoSansKR.variable` / `jetbrainsMono.variable` 을 `<body className>` 에 주입

### 이 phase 의 핵심 전환

1. **dark default 전환**: 기존 `light(default) + .dark(override)` → 새 `dark(default) + :root:not(.dark)(light override)`. `.dark { ... }` 별도 블록은 **삭제** (새 패턴이 동일 결과 제공: `<html class="dark">` 토글 시 `:root:not(.dark)` 가 비활성, `@theme` 의 dark 기본값이 활성)
2. **body font-family 단순화**: `var(--font-sans), "Noto Sans KR", ...` fallback chain → `var(--font-sans)` 단일. fallback 은 새 `--font-sans` 토큰 정의 안에 흡수 (`"Geist", "Pretendard", -apple-system, ...`)
3. **카테고리 9 클래스 교체**: 기존 `architecture/database/javascript/default` 등 → 새 `ai/algorithm/db/devops/java/js/react/next/system` 9 클래스 (oklch 토큰 + color-mix 패턴, `@apply` 미사용)
4. **shadcn foundation**: shadcn init + Button 1개 시범 (다음 plan 에서 사용) — Tailwind v4 호환 검증 필수

## 먼저 읽을 문서

- `docs/adr.md` — **ADR-017** (디자인 시스템 결정)
- `docs/design-inspiration.md` — 영감 보드 + Claude Design 프롬프트
- `src/app/globals.css` — 현재 `@theme` 블록 (4 변수 + dark mode + prose + scrollbar + animation)
- `src/app/layout.tsx` — 현재 `Noto_Sans_KR` + `JetBrains_Mono` import (line 12-24)
- `package.json` — Tailwind 4, Next.js 16
- `.claude/skills/_shared/common-critic-patterns.md` — BLG2 (구조화 로그)

## 핵심 토큰 출처 (source of truth)

Claude Design handoff bundle: `~/.claude/projects/-Users-nhn-personal-fos-blog/d11b8756-7896-451b-932e-0678c2241d67/tool-results/webfetch-1777097520807-wx9in3.bin` (gzip tar). 추출:

```bash
# cwd: <worktree root>
tar xzOf ~/.claude/projects/-Users-nhn-personal-fos-blog/d11b8756-7896-451b-932e-0678c2241d67/tool-results/webfetch-1777097520807-wx9in3.bin 'fos-blog/project/tokens.js' > /tmp/tokens.js
tar xzOf ~/.claude/projects/-Users-nhn-personal-fos-blog/d11b8756-7896-451b-932e-0678c2241d67/tool-results/webfetch-1777097520807-wx9in3.bin 'fos-blog/project/styleguide.css' > /tmp/styleguide.css
```

`tokens.js` 의 `window.FOS_TOKENS` 객체가 모든 값의 source. 이 phase 의 모든 hex/oklch 는 여기서 가져옴.

## 작업 목록 (총 5개)

### 1. `src/app/globals.css` — `@theme` + `:root` 토큰 확장

기존 4 변수를 50+ 토큰으로 확장. Pretendard CDN import 도 추가.

**파일 상단 (Tailwind import 다음)**:
```css
@import "tailwindcss";
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css");
@source "./app/**/*.{ts,tsx}";
@source "../components/**/*.{ts,tsx}";

@variant dark (&:where(.dark, .dark *));
```

**`@theme` 블록** (Tailwind v4 자동 클래스 생성 — color/font/spacing/radius):

```css
@theme {
  /* Background — dark default */
  --color-bg-base: #000000;
  --color-bg-subtle: #070708;
  --color-bg-elevated: #0d0d0f;
  --color-bg-overlay: #141417;
  --color-bg-inverse: #f7f7f8;

  /* Foreground */
  --color-fg-primary: #f4f4f5;
  --color-fg-secondary: #a1a1aa;
  --color-fg-muted: #71717a;
  --color-fg-faint: #52525b;
  --color-fg-on-brand: #04161a;

  /* Border */
  --color-border-subtle: #1a1a1d;
  --color-border-default: #27272a;
  --color-border-strong: #3f3f46;

  /* Brand — cyan-leaning teal (oklch 0.78 0.13 195) */
  --color-brand-50: oklch(0.97 0.025 195);
  --color-brand-100: oklch(0.93 0.05 195);
  --color-brand-200: oklch(0.88 0.08 195);
  --color-brand-300: oklch(0.83 0.11 195);
  --color-brand-400: oklch(0.78 0.13 195);  /* PRIMARY */
  --color-brand-500: oklch(0.72 0.13 195);
  --color-brand-600: oklch(0.62 0.115 198);
  --color-brand-700: oklch(0.5 0.095 200);
  --color-brand-800: oklch(0.38 0.07 200);
  --color-brand-900: oklch(0.26 0.05 200);

  /* Categories 9 — chroma 0.09, lightness 0.74 (dark) — light variant 는 .dark variant 에서 override */
  --color-cat-ai: oklch(0.74 0.09 285);
  --color-cat-algorithm: oklch(0.74 0.09 25);
  --color-cat-db: oklch(0.74 0.09 55);
  --color-cat-devops: oklch(0.74 0.09 145);
  --color-cat-java: oklch(0.74 0.09 180);
  --color-cat-js: oklch(0.74 0.09 90);
  --color-cat-react: oklch(0.74 0.09 220);
  --color-cat-next: oklch(0.74 0.09 0);
  --color-cat-system: oklch(0.74 0.09 250);

  /* Semantic */
  --color-success: oklch(0.74 0.13 150);
  --color-warning: oklch(0.8 0.13 75);
  --color-error: oklch(0.7 0.17 25);
  --color-info: oklch(0.74 0.11 230);

  /* Font families */
  --font-sans: "Geist", "Pretendard", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --font-kr: "Pretendard", -apple-system, sans-serif;

  /* Radius */
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-default: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 999px;
}
```

**`:root` 블록** (Tailwind 클래스 생성 불필요한 변수):

```css
:root {
  /* Mesh stops — Stripe-like cool */
  --mesh-stop-01: oklch(0.7 0.16 230);   /* blue */
  --mesh-stop-02: oklch(0.78 0.13 195);  /* cyan */
  --mesh-stop-03: oklch(0.65 0.18 280);  /* violet */
  --mesh-stop-04: oklch(0.72 0.14 250);  /* indigo */
  --mesh-stop-05: oklch(0.68 0.15 175);  /* teal */
  --mesh-stop-06: oklch(0.6 0.2 305);    /* magenta */

  /* Shadow — dark default */
  --shadow-subtle: 0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 1px 2px 0 rgb(0 0 0 / 0.4);
  --shadow-default: 0 1px 0 0 rgb(255 255 255 / 0.06) inset, 0 4px 12px -2px rgb(0 0 0 / 0.5), 0 0 0 1px rgb(255 255 255 / 0.04);
  --shadow-popover: 0 1px 0 0 rgb(255 255 255 / 0.08) inset, 0 12px 32px -4px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.06);
  --shadow-modal: 0 1px 0 0 rgb(255 255 255 / 0.08) inset, 0 32px 64px -8px rgb(0 0 0 / 0.8), 0 0 0 1px rgb(255 255 255 / 0.08);

  /* Motion duration */
  --duration-instant: 75ms;
  --duration-fast: 150ms;
  --duration-default: 250ms;
  --duration-slow: 400ms;

  /* Motion easing */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-linear: linear;

  /* Density variables (default) — compact/spacious 변형 클래스는 별도 plan */
  --d-section-y: 96px;
  --d-card-pad: 24px;
  --d-row-gap: 16px;
}
```

**Light mode override** (현 `@variant dark` 패턴 활용 — light 가 fallback):

```css
:root:not(.dark) {
  --color-bg-base: #f7f7f8;
  --color-bg-subtle: #ffffff;
  --color-bg-elevated: #ffffff;
  --color-bg-overlay: #ededef;
  --color-bg-inverse: #0a0a0b;

  --color-fg-primary: #0a0a0b;
  --color-fg-secondary: #3f3f46;
  --color-fg-muted: #71717a;
  --color-fg-faint: #a1a1aa;

  --color-border-subtle: #ececee;
  --color-border-default: #d4d4d8;
  --color-border-strong: #a1a1aa;

  --color-cat-ai: oklch(0.5 0.11 285);
  --color-cat-algorithm: oklch(0.5 0.11 25);
  --color-cat-db: oklch(0.5 0.11 55);
  --color-cat-devops: oklch(0.5 0.11 145);
  --color-cat-java: oklch(0.5 0.11 180);
  --color-cat-js: oklch(0.5 0.11 90);
  --color-cat-react: oklch(0.5 0.11 220);
  --color-cat-next: oklch(0.5 0.11 0);
  --color-cat-system: oklch(0.5 0.11 250);

  --shadow-subtle: 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --shadow-default: 0 1px 3px 0 rgb(0 0 0 / 0.06), 0 4px 12px -2px rgb(0 0 0 / 0.06);
  --shadow-popover: 0 4px 8px -2px rgb(0 0 0 / 0.08), 0 12px 32px -4px rgb(0 0 0 / 0.12);
  --shadow-modal: 0 8px 16px -4px rgb(0 0 0 / 0.1), 0 32px 64px -8px rgb(0 0 0 / 0.18);
}
```

**body 기본 스타일** (한글 가독성):
```css
body {
  color: var(--color-fg-primary);
  background: var(--color-bg-base);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.7;
  letter-spacing: -0.005em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code, kbd, samp, pre {
  font-family: var(--font-mono);
}
```

**카테고리 클래스 갱신** — 9개 새 키 (기존 `category-architecture/database/javascript/default` 삭제):

```css
.category-ai        { background: color-mix(in oklch, var(--color-cat-ai) 12%, transparent); color: var(--color-cat-ai); }
.category-algorithm { background: color-mix(in oklch, var(--color-cat-algorithm) 12%, transparent); color: var(--color-cat-algorithm); }
.category-db        { background: color-mix(in oklch, var(--color-cat-db) 12%, transparent); color: var(--color-cat-db); }
.category-devops    { background: color-mix(in oklch, var(--color-cat-devops) 12%, transparent); color: var(--color-cat-devops); }
.category-java      { background: color-mix(in oklch, var(--color-cat-java) 12%, transparent); color: var(--color-cat-java); }
.category-js        { background: color-mix(in oklch, var(--color-cat-js) 12%, transparent); color: var(--color-cat-js); }
.category-react     { background: color-mix(in oklch, var(--color-cat-react) 12%, transparent); color: var(--color-cat-react); }
.category-next      { background: color-mix(in oklch, var(--color-cat-next) 12%, transparent); color: var(--color-cat-next); }
.category-system    { background: color-mix(in oklch, var(--color-cat-system) 12%, transparent); color: var(--color-cat-system); }
```

**기존 `prose`, `scrollbar`, `animate-fade-in` 정의 유지** — 토큰 변수 직접 참조 안 하므로 영향 없음.

**삭제 대상** (충돌/중복 제거):
- `.dark { --color-background: #0a0a0a; --color-foreground: #ededed; }` 별도 블록 — 새 `:root:not(.dark)` 패턴이 동일 결과 제공 (dark 가 default, light 가 override). 잔존 시 `--color-background` 가 두 곳에서 정의되어 cascade 우선순위 혼선 가능
- 기존 body 의 `font-family: var(--font-sans), "Noto Sans KR", system-ui, ...` 의 fallback chain — 새 `--font-sans` 토큰 정의가 fallback 을 흡수하므로 단순화
- 기존 body 의 `font-family: var(--font-mono), "JetBrains Mono", ...` — `code, kbd, samp, pre` 의 새 정의로 교체

### 2. `src/app/layout.tsx` — 폰트 교체

기존 `next/font/google` import (line 1-4) 와 `Noto_Sans_KR`, `JetBrains_Mono` 정의 제거. 대신:

```ts
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
```

`<body>` className:
```tsx
<body className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
```

`notoSansKR.variable` / `jetbrainsMono.variable` 참조 제거.

### 3. `pnpm add geist` (의존성 추가)

```bash
# cwd: <worktree root>
pnpm add geist
```

`package.json` 의 `dependencies` 에 `"geist"` 추가됨. lockfile 갱신.

### 4. shadcn/ui foundation 도입

**사전 백업** (대화형 init 가 globals.css 덮어쓸 수 있음):
```bash
# cwd: <worktree root>
cp src/app/globals.css /tmp/globals.css.pre-shadcn.bak
```

**shadcn init**:
```bash
# cwd: <worktree root>

# 1) -d 플래그 동작 확인 (defaults 적용 + 비대화형)
pnpm dlx shadcn@latest init --help 2>&1 | grep -E "(-d|--defaults|--yes)"

# 2) init 실행 — Tailwind v4 + RSC + TS 환경 자동 감지 기대
pnpm dlx shadcn@latest init -d
# defaults: Style=Default, Base color=Neutral, CSS vars=Yes, alias=@/*

# 3) Tailwind v4 호환 검증
test -f components.json
cat components.json | grep -E '"tailwind"' | head -3
# 기대: tailwind.config 가 비어 있거나 v4 인식. v3 가정 시 "tailwind": { "config": "tailwind.config.ts" } 등 깨진 경로 출력 → PHASE_BLOCKED
```

**비대화형 실패 시 대안**: shadcn cli 가 `-d` 무시하고 프롬프트를 띄우면 다음 응답 자동화:
```bash
# cwd: <worktree root>
printf "Default\nNeutral\nyes\n@/*\n" | pnpm dlx shadcn@latest init
```
또는 `components.json` 을 수동으로 작성 (Tailwind v4 호환 형식 — 후속 plan 에서 처리, 이번 plan 에선 PHASE_BLOCKED).

`init` 결과:
- `components.json` 생성
- `src/lib/utils.ts` 의 `cn()` 추가 (이미 있으면 함수 추가만)
- `src/components/ui/` 디렉터리 생성

**충돌 해결** — shadcn init 가 `globals.css` 의 `@theme` 또는 `:root` 에 자기 변수 (`--background`, `--foreground` 등) 추가했으면 우리 토큰과 병합:
- 같은 변수명이면 우리 값 winner (작업 1 의 결과)
- 다른 변수명이면 그대로 유지 (`--ring`, `--input` 등 shadcn 전용)
- `globals.css` 가 이상하게 깨졌으면 backup 으로 복원 후 우리 작업 1 결과 + shadcn 변수만 수동 병합

**Button 시범 추가**:
```bash
# cwd: <worktree root>
pnpm dlx shadcn@latest add button
```

`src/components/ui/button.tsx` 자동 생성. 아무 페이지에서 import 안 해도 됨 (다음 plan 에서 사용).

### 5. 통합 검증

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# globals.css 토큰 확인
grep -n -- "--color-bg-base" src/app/globals.css
grep -n -- "--color-brand-400" src/app/globals.css
grep -nE -- "--color-cat-(ai|algorithm|db|devops|java|js|react|next|system)" src/app/globals.css | wc -l  # = 9
grep -n -- "--mesh-stop-01" src/app/globals.css

# 폰트 import
grep -n "geist/font/sans" src/app/layout.tsx
grep -n "pretendard" src/app/globals.css

# shadcn 산출물
test -f components.json
test -f src/lib/utils.ts
grep -n "export function cn" src/lib/utils.ts
test -f src/components/ui/button.tsx

# 기존 카테고리 클래스 제거 (architecture/database/javascript)
! grep -n -- "category-architecture" src/app/globals.css
! grep -n -- "category-database " src/app/globals.css
! grep -n -- "category-javascript" src/app/globals.css

# Noto Sans KR / JetBrains Mono import 제거
! grep -n "Noto_Sans_KR" src/app/layout.tsx
! grep -n "JetBrains_Mono" src/app/layout.tsx
```

빌드 산출물 확인:
```bash
grep -rE "Geist|pretendard" .next/server/app/ 2>/dev/null | head -3
grep -rE "oklch\(0\.78 0\.13 195\)" .next/static/ 2>/dev/null | head -3
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) globals.css 핵심 토큰
grep -n -- "--color-bg-base" src/app/globals.css
grep -n -- "--color-fg-primary" src/app/globals.css
grep -nE -- "--color-brand-(50|400|900)" src/app/globals.css | wc -l  # = 3
grep -nE -- "--color-cat-(ai|algorithm|db|devops|java|js|react|next|system)" src/app/globals.css | wc -l  # = 9
grep -nE -- "--mesh-stop-0[1-6]" src/app/globals.css | wc -l  # = 6
grep -nE -- "--duration-(instant|fast|default|slow)" src/app/globals.css | wc -l  # = 4
grep -nE -- "--ease-(out|spring|linear)" src/app/globals.css | wc -l  # = 3

# 2) light mode override
grep -nE ":root:not\(\.dark\)" src/app/globals.css

# 3) Pretendard CDN import
grep -n "pretendard.css" src/app/globals.css

# 4) 폰트 교체 (layout.tsx)
grep -n 'from "geist/font/sans"' src/app/layout.tsx
grep -n 'from "geist/font/mono"' src/app/layout.tsx
! grep -n "Noto_Sans_KR" src/app/layout.tsx
! grep -n "JetBrains_Mono" src/app/layout.tsx

# 5) geist 의존성
grep -n '"geist"' package.json

# 6) shadcn init 산출물
test -f components.json
test -f src/lib/utils.ts
grep -n "export function cn" src/lib/utils.ts
test -f src/components/ui/button.tsx

# 7) 카테고리 클래스 9개 + 구 클래스 제거
grep -nE "\.category-(ai|algorithm|db|devops|java|js|react|next|system)\b" src/app/globals.css | wc -l  # = 9
! grep -nE "\.category-(architecture|database|javascript|default)\b" src/app/globals.css

# 8) body letter-spacing + line-height
grep -nE "letter-spacing:\s*-?0\.005em" src/app/globals.css
grep -nE "line-height:\s*1\.7" src/app/globals.css

# 9) 통합 검증 통과
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 10) @source 디렉티브 보존 (shadcn init 가 덮어쓰지 않았는지)
test "$(grep -c '^@source' src/app/globals.css)" -ge 2

# 11) 금지사항 (button.tsx 도 검사 — shadcn 산출물이지만 우리가 검증)
! grep -nE "as any" src/app/layout.tsx src/app/globals.css src/components/ui/button.tsx
```

## PHASE_BLOCKED 조건

- shadcn init 가 globals.css 의 우리 토큰을 덮어써서 복구 어려움 → **PHASE_BLOCKED: backup 으로 복원 후 shadcn 의 변수만 수동 병합 필요**
- Geist 폰트가 Next.js 16 / Tailwind v4 와 호환 안 됨 (typing 에러) → **PHASE_BLOCKED: geist 패키지 버전 확인 + workaround 검토**
- `@variant dark` 와 `:root:not(.dark)` 조합으로 light/dark 토글이 깨짐 → **PHASE_BLOCKED: ThemeProvider 의 class 적용 방식 재확인**
- oklch 가 빌드 시 변환 에러 → **PHASE_BLOCKED: PostCSS 설정 (Tailwind v4 는 자동) 확인**
- shadcn cli 가 `-d` 무시하고 인터랙티브 프롬프트 진입 → **PHASE_BLOCKED: 비대화형 대안(printf pipe) 도 실패 → components.json 수동 작성 후속 plan 으로 분리**
- shadcn init 결과 `components.json` 의 `tailwind.config` 가 v3 형식 (config 파일 경로 강제 등) 으로 생성되어 빌드 실패 → **PHASE_BLOCKED: shadcn cli 의 Tailwind v4 호환 버전 확인 또는 수동 components.json 작성**

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋 (atomic commits 분리 권장):
- `feat(design): expand globals.css @theme + :root tokens (Claude Design handoff)`
- `feat(fonts): replace Noto Sans KR/JetBrains Mono with Geist + Pretendard`
- `chore(shadcn): init shadcn/ui foundation + add Button`
- `chore: bump deps (geist)`

## 운영 영향

- 기존 컴포넌트가 토큰 변수를 직접 참조하지 않음 → 시각 변화는 **폰트 교체** 와 **body letter-spacing/line-height** 만
- 한글 폭이 Pretendard 로 살짝 달라질 수 있음 → Lighthouse CLS 회귀 자동 검출
- 다음 plan (plan010 컴포넌트 리디자인) 의 토대 — PostCard / Hero / Article / Code Block 등이 토큰 사용

## 수동 검증 (성공 기준 아님 — 사용자/team-lead 가 PR 리뷰 시 참고)

> 이 섹션은 **성공 기준이 아니다**. executor 는 위 "성공 기준 (기계 명령만)" 만 통과하면 phase 완료. 아래는 PR 리뷰 단계에서 사용자가 눈으로 검증할 항목.
>
> - `pnpm dev` → 홈/글 상세 페이지 — 폰트가 Geist+Pretendard 로 교체됨, 그 외 색상/spacing 은 동일 (컴포넌트가 토큰 미참조이므로)
> - 다크/라이트 토글 동작 (`<html class="dark">` ↔ 일반)
> - Lighthouse: Performance ≥ 90, Accessibility ≥ 95 (`.github/workflows/lighthouse.yml` CI 자동 실행)
