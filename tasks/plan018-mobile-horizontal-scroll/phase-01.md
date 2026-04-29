# Phase 01 — prose word-break + CodeCard parent min-w-0 + hero-meta dl mobile fallback

**Model**: sonnet
**Status**: pending

---

## 목표

모바일 (375px) 에서 페이지 가로 스크롤이 발생하지 않도록 위젯별 폭 방어를 추가한다. body 의 `overflow-x: clip` 같은 안전망은 사용하지 않음 (콘텐츠 손실 방지) — 의도된 위젯이 자체 스크롤하거나 wrap 하도록 명시.

**진단 결과 요약** (코드 분석 + 1050px DevTools 측정 기준):
- HomeHero `<header>` 는 `overflow-hidden` 있음 → HeroMesh contained ✅
- `.code-card-body` 는 `overflow-x: auto` 있음 → CodeCard 자체는 OK
- markdown table wrapper `overflow-x-auto` 있음 ✅
- Mermaid `overflow-x-auto` 있음 ✅
- **누락**: globals.css 에 `.prose` 의 inline code / URL 에 대한 `word-break` / `overflow-wrap` 규칙 없음
- **누락**: HomeHero 의 `dl.hero-meta grid-cols-2` 가 모바일 폭에서 stat 라벨이 길면 컬럼 초과
- **방어**: CodeCard 가 grid/flex 부모 안에서 `min-w-0` 누락 시 자식 폭에 부모가 늘어남

**범위 외**: legacy `/category/[...path]` (plan015 진행 중), 글 상세 페이지 그리드 자체 (이미 `min-w-0` 적용됨), Footer / Navbar / 검색 모달 등 글로벌 위젯 (DevTools smoke 결과 회귀 발견 시 후속 plan 으로 분리).

---

## 작업 항목 (4)

### 1. `src/app/globals.css` — `.prose` word-break / overflow-wrap 추가

`.prose` 영역의 inline code 와 긴 URL 이 wrap 되도록 규칙 추가. 위치: 기존 `.prose img { ... }` (line **158**) 근처:

```css
/* prose 의 inline code / 긴 URL / 한글 단어 자동 줄바꿈
 * - overflow-wrap: anywhere — wrap 우선
 * - word-break: break-word — 한글/CJK 의 자연 줄바꿈 보장
 * 모바일 (375px) 에서 inline code <code class="bg-[...]">very-long-identifier</code> 같은
 * 토큰이 부모 폭 초과해 페이지 가로 스크롤 유발하는 사고 방지. */
.prose {
  overflow-wrap: anywhere;
  word-break: break-word;
}
/* inline code 는 더 공격적으로 — 식별자 한가운데서도 wrap.
 * 기존 globals.css line 211 의 `.prose :not(pre) > code` 패턴을 그대로 사용해서
 * `pre code` (CodeCard / shiki 토큰) 와의 selector 충돌 회피. */
.prose :not(pre) > code {
  overflow-wrap: anywhere;
  word-break: break-all;
}
```

`break-word` vs `break-all` 차이: `break-all` 은 영문 단어 한가운데 wrap (모바일 inline code 에 적합), `break-word` 는 단어 경계 우선.

**selector 선택 이유 (critic 지적 반영)**: `:where(code):not(:where([class~="not-prose"] *))` 패턴은 `not-prose` wrapper 가 없는 모든 `code` 에 적용 → CodeCard / Mermaid 의 `pre code` 토큰까지 break-all 이 걸려 코드 줄바꿈 사고 가능. 기존 line 211 의 `.prose :not(pre) > code` 패턴은 부모가 `pre` 인 경우를 정확히 제외 — 동일 selector 채택해 회귀 차단. CodeCard 코드 토큰은 영향 없음.

**검증**: 추가 후 글 상세 페이지에 매우 긴 식별자 (`AbsolutelyVeryLongIdentifierNameThatCouldBeOverflowing`) inline code 를 포함한 더미 markdown 으로 모바일 뷰 wrap 확인.

### 2. `src/components/HomeHero.tsx` — `dl.hero-meta` 모바일 폴백

기존 (HomeHero.tsx:57, 정확한 className):
```tsx
<dl className="hero-meta mt-10 grid grid-cols-2 gap-x-8 gap-y-4 font-mono text-[12px] md:grid-cols-4">
```

`grid-cols-2` 가 모바일에서 stat 항목 4개를 2×2 로 배치하지만, 라벨 (`POSTS` `CATEGORIES` `SERIES` `SUBSCRIBERS`) 중 가장 긴 `SUBSCRIBERS` (11자) + 값 (`1.2k`) + gap-x-8 (32px) 이 175px 이상 차지 가능. 모바일 viewport 375 - px-6 (48px) = 327px 안에 2 컬럼 (각 ~163px) 압박.

수정: 모바일 1 컬럼 (`grid-cols-1`), `sm:` (640px+) 부터 2 컬럼, **`md:grid-cols-4` 보존** (768px+ 데스크톱 4컬럼 회귀 방지). `text-[12px]` 도 보존:

```tsx
<dl className="hero-meta mt-10 grid grid-cols-1 gap-x-8 gap-y-4 font-mono text-[12px] sm:grid-cols-2 md:grid-cols-4">
```

**중요 (critic 지적 반영)**: 기존에 이미 `md:grid-cols-4` 가 있어 데스크톱은 4컬럼이다. 이 클래스를 누락하면 데스크톱 레이아웃이 회귀하므로 executor 는 위 className 을 그대로 적용. Tailwind 우선순위: `grid-cols-1` (모바일) → `sm:grid-cols-2` (640px+) → `md:grid-cols-4` (768px+) 순으로 정상 cascade. `gap-x-8` 은 1 컬럼에서 효과 없음 (gap-y-4 만 적용 — OK).

**대안 (B)**: 4 항목을 모바일에서 2×2 로 유지하되 라벨 단축 (`SUBS` 등) — UX 손상 → 채택 X.

### 3. `src/components/CodeCard.tsx` (또는 globals.css `.code-card`) — 부모 grid 셀 안에서 `min-w-0` 보장

CodeCard 자체는 figure → `code-card-body` (overflow-x: auto). 문제: figure 가 grid/flex 셀 안에 있을 때 grid item 의 default `min-width: auto` 로 인해 자식 폭에 부모가 늘어남.

`/posts/[...slug]` 페이지는 이미 `<article className="min-w-0">` 적용 (page.tsx:182). 다른 페이지에서 CodeCard 가 등장할 가능성 (예: `/category/[...path]` 의 ReadmeFrame 안 — plan015 가 처리) 대비 globals.css 에 방어:

```css
/* CodeCard (figure.code-card) 가 grid/flex item 안에 있을 때 부모를 늘리지 않도록
 * min-width: 0 강제. fig 자체는 .code-card-body 의 overflow-x: auto 에 의존. */
.code-card {
  min-width: 0;
}
```

**위치**: 기존 `.prose .code-card { ... }` (line **234**) 의 첫 줄에 `min-width: 0;` 추가.

### 4. `src/app/posts/[...slug]/page.tsx` 본문 grid 의 article `min-w-0` 재확인 (회귀 차단)

기존 `<article className="min-w-0">` 가 있는지 확인. 누락되어 있으면 추가. **만약 이미 있으면 변경 없음** — 회귀 차단 목적의 grep 만 수행:

```bash
grep -n "min-w-0" src/app/posts/\[...slug\]/page.tsx | head -3
# 출력에 article 라인 포함되어야 함. 없으면 추가.
```

같은 패턴으로 `/category/[...path]/page.tsx` 도 점검 (plan015 가 다시 작성하지만, 그 전에 깨지지 않게).

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/app/globals.css` | `.prose` word-break/overflow-wrap, `.prose :not(pre) > code` break-all, `.code-card` min-width:0 |
| `src/components/HomeHero.tsx` | `dl.hero-meta` `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` (md 보존) |
| `src/app/posts/[...slug]/page.tsx` | `min-w-0` 점검 (이미 있으면 변경 없음) |
| `src/app/category/[...path]/page.tsx` | `min-w-0` 점검 (이미 있으면 변경 없음) |

## 검증 (이 phase 한정)

```bash
pnpm lint
pnpm type-check
pnpm test --run

# 신규 CSS 규칙 추가 확인
grep -n "overflow-wrap: anywhere" src/app/globals.css
grep -n "word-break: break-all" src/app/globals.css
grep -n "min-width: 0" src/app/globals.css | head -3

# HomeHero 모바일 grid (md:grid-cols-4 보존 확인)
grep -n "grid-cols-1 sm:grid-cols-2 md:grid-cols-4" src/components/HomeHero.tsx
```

수동 smoke 는 phase 02 에서 (DevTools 모바일 뷰 + Lighthouse).

## 의도 메모 (왜)

- **body `overflow-x: clip` 안 함** 이유: 사용자 결정 (Q1=근본 해결만). 안전망은 위젯 잘림 사고를 가리는 부작용 — 디버깅 어려워짐. 의도적으로 위젯별 방어로 명시
- **`.prose code` 에 `break-all`**: 영문 식별자 (`UserCredentialAuthenticator`) 가 한가운데서 wrap 되어야 모바일에서 읽힘. CJK 본문은 자연 wrap, 영문 식별자만 강제 break. `not-prose` wrapper 안 (예: `pre code`) 에는 미적용 — 코드 블록은 스크롤
- **HomeHero 1 컬럼 모바일**: 라벨 글자 수 가변 (영문) → 2 컬럼 폭 보장 어려움. 1 컬럼으로 떨어뜨리면 stat 별 행 1줄 — 깔끔
- **`.code-card { min-width: 0 }`**: grid item 의 default `min-width: auto` 가 figure 폭을 자식 따라 늘림. 명시 0 으로 부모 폭 인지 — 모바일/데스크톱 양쪽 안전망. `overflow-x: auto` 와 결합되어 스크롤 정상 발생
