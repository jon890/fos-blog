# DESIGN.md — fos-blog 디자인 시스템

**관련 ADR**: [ADR-029](./adr.md#adr-029) (도입 결정) · [ADR-017](./adr.md#adr-017) (디자인 시스템 톤) · [ADR-019](./adr.md#adr-019) (코드 블록)
**영감 보드 / 생성 과정**: [design-inspiration.md](./design-inspiration.md)

이 문서는 [Google Stitch DESIGN.md 컨벤션](https://github.com/voltagent/awesome-design-md) 9섹션 형식으로,
AI agent 가 "이 디자인처럼 페이지/컴포넌트를 만들어줘" 를 일관되게 수행하도록 fos-blog 의 시각·상호작용 규칙을 정의한다.

> **Source of truth 정책**
> 모든 토큰 값의 단일 소스는 [`src/app/globals.css`](../src/app/globals.css) 의 `@theme` 블록이다.
> 이 문서는 사람·외부 agent 가 읽기 위한 **스냅샷**이며, 값이 어긋나면 **`globals.css` 가 우선**한다.
> 토큰 값을 바꿀 때는 `globals.css` 를 고치고, 이 문서의 해당 표를 함께 갱신한다.

---

## 1. Visual Theme & Atmosphere

모던 dev-tool 톤. "엔지니어가 만든 도구" 같은 절제되고 정확한 인상.

- **베이스 — Vercel**: pure black/white, Geist 폰트, 미세 grid 라인(1px subtle border), 작은 radius, 빠른 transition
- **액센트 — Stripe**: hero 영역에만 흐르는 다중 컬러 그라디언트 mesh
- **디테일 — Linear**: 큰 hero 텍스트 처리 일부 차용
- **다크 우선**: default `dark`. light 는 동등한 1급 테마(`:root:not(.dark)` override)
- **개성**: 절제·정확. 장식보다 정보 위계와 여백으로 표현. 브랜드 컬러는 cyan-leaning teal 한 색으로 집중

근거는 [ADR-017](./adr.md#adr-017).

---

## 2. Color Palette & Roles

모든 색은 oklch(브랜드·카테고리·semantic) 또는 hex(중립 배경·전경). dark/light 양쪽 정의.
값 출처: `globals.css` `@theme` 블록 + `:root:not(.dark)` override.

### Background / Foreground / Border (중립, hex)

| 역할 | 토큰 | Dark | Light |
|---|---|---|---|
| 배경 base | `--color-bg-base` | `#000000` | `#f7f7f8` |
| 배경 subtle | `--color-bg-subtle` | `#070708` | `#ffffff` |
| 배경 elevated | `--color-bg-elevated` | `#0d0d0f` | `#ffffff` |
| 배경 overlay | `--color-bg-overlay` | `#141417` | `#ededef` |
| 전경 primary | `--color-fg-primary` | `#f4f4f5` | `#0a0a0b` |
| 전경 secondary | `--color-fg-secondary` | `#a1a1aa` | `#3f3f46` |
| 전경 muted | `--color-fg-muted` | `#71717a` | `#71717a` |
| 전경 faint | `--color-fg-faint` | `#52525b` | `#a1a1aa` |
| 테두리 subtle | `--color-border-subtle` | `#1a1a1d` | `#ececee` |
| 테두리 default | `--color-border-default` | `#27272a` | `#d4d4d8` |
| 테두리 strong | `--color-border-strong` | `#3f3f46` | `#a1a1aa` |

### Brand — cyan-leaning teal

`--color-brand-50` … `--color-brand-900` 9단계.
PRIMARY 는 `--color-brand-400` = `oklch(0.78 0.13 195)`.
hue 195 고정, lightness·chroma 만 단계별 변형.

brand-400 은 장식(보더·배경·caret·gradient)에서 dark/light 공통으로 쓴다.
강조 텍스트는 `--color-brand-text` 로 분리한다.
brand-400 은 밝은 청록이라 흰 배경에서 대비가 1.9:1 로 무너지기 때문이다(WCAG AA 미달).
brand-text 의 dark 값은 brand-400 과 같고, light 값은 `oklch(0.5 0.11 195)` 로 내려 대비 5.5:1(AA 통과)을 확보한다.

### Categories — 9 canonical

`ai / algorithm / db / devops / java / js / react / next / system`.
**hue 만 변형, chroma·lightness 통일** — dark `oklch(0.74 0.09 H)`, light `oklch(0.50 0.11 H)`.

| 카테고리 | hue | 토큰 |
|---|---|---|
| ai | 285 | `--color-cat-ai` |
| algorithm | 25 | `--color-cat-algorithm` |
| db | 55 | `--color-cat-db` |
| devops | 145 | `--color-cat-devops` |
| java | 180 | `--color-cat-java` |
| js | 90 | `--color-cat-js` |
| react | 220 | `--color-cat-react` |
| next | 0 | `--color-cat-next` |
| system | 250 | `--color-cat-system` |

데이터의 raw 카테고리 키(architecture/network/interview 등)는 `src/lib/category-meta.ts` 에서 9종으로 정규화(미매핑 → `system`).
배지 배경은 `color-mix(in oklch, var(--color-cat-*) 12%, transparent)` (`.category-*` 클래스).

### Semantic

| 역할 | 토큰 | 값 |
|---|---|---|
| success | `--color-success` | `oklch(0.74 0.13 150)` |
| warning | `--color-warning` | `oklch(0.8 0.13 75)` |
| error | `--color-error` | `oklch(0.7 0.17 25)` |
| info | `--color-info` | `oklch(0.74 0.11 230)` |

### Mesh stops (hero 그라디언트 전용)

`--mesh-stop-01` … `--mesh-stop-06` (blue/cyan/violet/indigo/teal/magenta).
hero 배경에만 사용. 본문·컴포넌트에는 쓰지 않는다.

---

## 3. Typography Rules

### Font families

- **영문 UI/본문**: Geist Sans (`geist/font/sans`, next/font 로드 — `layout.tsx`)
- **영문 코드**: Geist Mono (`geist/font/mono`)
- **한글**: Pretendard (`globals.css` 에서 정적 import)
- 토큰: `--font-sans` (Geist → Pretendard fallback), `--font-mono`, `--font-kr`

### Body 기본 (`globals.css` `body`)

- size `16px` · line-height `1.7` · letter-spacing `-0.005em`
- antialiased (`-webkit-font-smoothing`)

### Prose 본문 위계 (`.prose`)

| 요소 | 규칙 |
|---|---|
| h2 | size `--prose-h2-size` (28px)<br>weight 600<br>letter-spacing -0.02em<br>margin-top 56px<br>`::before` 에 `01`·`02` 2자리 카운터(mono, muted) |
| blockquote | 좌측 2px brand-text border<br>`::before` 에 `QUOTE` 라벨(mono 10px, brand-text)<br>font-style normal |
| inline code | `--font-mono` · 0.88em · brand-text 색(강조 텍스트 토큰)<br>subtle border + bg-subtle 배경<br>`word-break: keep-all`(한글/식별자 글자단위 분해 방지) |
| ul marker | `— `(em dash), faint 색 |
| 링크 | `text-blue-600 dark:text-blue-400` + hover underline |

수식(KaTeX)은 본문 색 inherit, invalid LaTeX 오류만 빨강 유지.

---

## 4. Component Stylings

base 컴포넌트는 `@base-ui/react` primitive + `cva` variants(`src/components/ui/`).
shadcn 토큰(`--primary`, `--border` 등)은 `@theme inline` 으로 매핑(`globals.css` 하단).

### Button (`ui/button.tsx`)

기본: `rounded-lg` · `text-sm` · `font-medium` · `transition-all`.
focus-visible 시 `ring-3 ring-ring/50` + border-ring. active 시 `translate-y-px`(reduced-motion 면제).

| variant | 용도 |
|---|---|
| `default` | 주 액션 — `bg-primary text-primary-foreground` |
| `outline` | 보조 — border + hover muted |
| `secondary` | 약한 액션 — `bg-secondary` |
| `ghost` | 최소 — hover 시에만 배경 |
| `destructive` | 파괴적 — destructive 톤(배경 10% tint) |
| `link` | 텍스트 링크형 |

size: `xs / sm / default(h-8) / lg / icon / icon-xs / icon-sm / icon-lg`.

### Input (`ui/input.tsx`)

`h-8` · `rounded-lg` · transparent 배경 · border-input.
focus-visible `ring-3 ring-ring/50`. invalid 시 destructive ring. disabled 시 opacity-50.

### Code Card (`.code-card`, `globals.css` + `CodeCard.tsx`)

- 외곽: subtle border + `rounded-[8px]` + bg-subtle, `overflow:hidden`
- head: filename + `.lang` 배지(brand tint) + copy 버튼, mono 메타 폰트
- body: mono 13px · line-height 1.7 · `overflow-x:auto`
- line number: `[data-line-numbers]` 일 때만. 모바일(≤767px) 숨김
- variants: 기본 / `diff`(semantic +/−) / `terminal`(첫 라인 `$` prompt)
- 하이라이트: shiki dual theme — `html.dark` 토글로 `--shiki-dark`/`--shiki-light`

상세 근거는 [ADR-019](./adr.md#adr-019).

### Category badge / card

- badge: `.category-{name}` — 카테고리 색 12% tint 배경 + 카테고리 색 전경
- `.cat-card::after`: radial blob, hover 시 opacity 0.07(dark)/0.08(light), blend-mode screen/multiply
- `.post-list-row:hover`: 좌측 border 를 카테고리 색으로, 배경 4% tint

### Hero mesh (`.hero-mesh`, `HeroMesh.tsx`)

- 3 레이어 SVG, `blur(40px) saturate(140%)`
- 변형: `--default`(60–90s 회전) / `--subtle`(120–180s) / `--no-motion`
- `prefers-reduced-motion` 시 애니메이션 정지

---

## 5. Layout Principles

### Container 폭

| 용도 | 폭 |
|---|---|
| 사이트 컨테이너 | `max-w-[1180px]` |
| 글 본문 영역 | `max-w-[880px]` |
| 가독 텍스트 단(measure) | `max-w-[56ch]` ~ `max-w-[60ch]` |

기본 좌우 패딩 `px-4`, 가운데 정렬 `mx-auto`.

### Spacing / Density

- spacing scale: Tailwind 기본(4/8/12/16/24/32/48/64/96/128)
- density 토큰: `--d-section-y` 96px · `--d-card-pad` 24px · `--d-row-gap` 16px
- radius: `--radius-sm` 4 / `default` 6 / `md` 10 / `lg` 16 / `full` 999

### Motion

- duration: `--duration-instant` 75ms / `fast` 150ms / `default` 250ms / `slow` 400ms
- easing: `--ease-out` (cubic-bezier(0.22,1,0.36,1)) 기본 / `--ease-spring` / `--ease-linear`

### 3계층 헤더 위계

페이지 헤더는 정보 위계에 따라 시각 무게를 차등(plan016).

| 레벨 | 컴포넌트 | 무게 | 사용처 |
|---|---|---|---|
| Hero | `HomeHero` | 강(mesh + 큰 텍스트 + 액션) | `/` |
| SubHero | `PostsListSubHero` | 중(eyebrow + h1, mesh 없음) | `/posts/latest`·`/posts/popular` |
| ArticleHero | `ArticleHero` | 강(article mesh + TOC) | `/posts/[...path]` |

---

## 6. Depth & Elevation

elevation 은 대부분 **1px border(subtle)** 로 표현하고, shadow 는 떠 있는 표면에만 절제해서 쓴다.

| 레벨 | 토큰 | Dark | Light |
|---|---|---|---|
| subtle | `--shadow-subtle` | inset highlight + 약한 그림자 | 단일 약한 그림자 |
| default | `--shadow-default` | inset + 중간 그림자 + 1px ring | 2단 부드러운 그림자 |
| popover | `--shadow-popover` | 깊은 그림자 + ring | 2단 중간 그림자 |
| modal | `--shadow-modal` | 가장 깊은 그림자 + ring | 깊은 부드러운 그림자 |

dark 는 inset highlight(`rgb(255 255 255 / …)`)와 1px ring 으로 표면을 분리,
light 는 순수 drop shadow. 정확한 값은 `globals.css`.

---

## 7. Do's & Don'ts

### Do

- 색은 **토큰으로**(`bg-[var(--color-...)]` / shadcn 매핑 클래스). 새 색이 필요하면 `globals.css` 에 토큰부터 추가
- 카테고리 색은 9 canonical + `category-meta.ts` 정규화를 거친다
- focus 는 항상 `focus-visible:ring-3 ring-ring/50` 일관 적용(접근성)
- 모션은 `prefers-reduced-motion` 대응을 함께 정의
- 한글 텍스트는 `word-break: keep-all`(식별자·한글 글자단위 분해 방지)
- dark/light 양쪽을 같이 확인 — light 는 fallback 이 아니라 1급 테마

### Don't

- ❌ `bg-blue-600` 같은 **raw Tailwind 색 직접 사용**(토큰 우회) — ADR-017 이 정리한 generic look 회귀
- ❌ mesh stop 색을 hero 밖 본문/컴포넌트에 사용
- ❌ shadow 남발 — 기본은 border, shadow 는 떠 있는 표면만
- ❌ radius 임의 값 — `--radius-*` 스케일 사용
- ❌ 이 문서에 적힌 값을 신뢰해 `globals.css` 와 어긋난 채 코드 작성 — **불일치 시 `globals.css` 가 정답**

---

## 8. Responsive Behavior

mobile-first. 주요 breakpoint 는 Tailwind `md`(768px) · `lg`(1024px), 일부 `sm`(640px).

- 컨테이너는 `max-w-[1180px]` 안에서 `px-4` 로 모바일 좌우 여백 확보
- 글 본문 inline code/긴 URL/한글은 `overflow-wrap: anywhere` + `word-break` 으로 가로 스크롤 사고 방지(375px 기준)
- code-card 는 `overflow-x:auto` 로 긴 코드 가로 스크롤, 모바일에서 line number 숨김
- 터치 타깃은 버튼 size 토큰(`h-8` 기본)으로 확보
- hero mesh·caret 등 모션은 `prefers-reduced-motion: reduce` 에서 정지

---

## 9. Agent Prompt Guide

AI agent 가 이 디자인으로 새 화면·컴포넌트를 만들 때 참조하는 빠른 규칙.

### 새 컴포넌트를 만들 때

1. 색·spacing·radius·shadow·motion 은 **`globals.css` 토큰**을 쓴다. raw 값 금지
2. base 컴포넌트는 `src/components/ui/`(base-ui + cva) 패턴을 따른다
3. focus-visible ring·reduced-motion·dark/light 3가지를 항상 같이 처리
4. 카테고리 색이 필요하면 `category-meta.ts` 정규화를 거친 9 canonical 만 사용
5. 본문(prose) 스타일을 건드리면 `.prose` 규칙(`globals.css`)과 충돌하지 않는지 확인

### 바로 쓰는 프롬프트 예시

```
fos-blog 의 DESIGN.md(docs/design.md)와 globals.css 토큰을 따라
{컴포넌트} 를 만들어줘.
- dark 우선, light 동등 지원
- 색/spacing/radius 는 globals.css 토큰만 사용(raw Tailwind 색 금지)
- focus-visible:ring-3 ring-ring/50 일관 적용
- prefers-reduced-motion 대응
- base 는 src/components/ui 의 base-ui + cva 패턴
```

### 새 mockup 이 필요할 때

Claude Design → 코드 구현 워크플로우는 [design-inspiration.md](./design-inspiration.md) 의 단계별 프롬프트를 사용한다.
이 문서(DESIGN.md)는 **확정된 현재 상태**, design-inspiration 은 **생성 과정**으로 역할이 다르다.
