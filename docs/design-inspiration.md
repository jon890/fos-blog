# Design Inspiration & Claude Design Prompts

**작성일**: 2026-04-25
**관련 ADR**: [ADR-017](./adr.md#adr-017)

fos-blog 의 모던 dev-tool 스타일 리디자인을 위한 영감 보드 + Claude Design 단계별 프롬프트. Claude Design (Anthropic Labs Research Preview, 2026-04-17 출시) 에서 mockup 생성 후 결과를 이 저장소의 코드로 구현하는 워크플로우.

---

## 영감 보드 — Vercel 베이스 + Stripe 그라디언트 액센트

### 1. **Vercel** (vercel.com / nextjs.org) — 베이스 톤

| 요소 | 시그니처 |
|---|---|
| **컬러** | Pure black `#000` / pure white `#fff` + 시안/블루 액센트 (`#0070f3`) |
| **타이포** | Geist Sans (선명한 ink, 글자 사이 살짝 좁음) + Geist Mono |
| **레이아웃** | 미세 그리드 라인 (1px subtle border) + 여백 풍부 |
| **컴포넌트** | rounded-md (작은 radius, 8px 기준), 1px solid border |
| **인터랙션** | 빠른 transition (150ms), 미세 hover (border 색만 변경) |
| **개성** | 절제된, 정확한, "엔지니어가 만든 도구" 느낌 |

→ **fos-blog 에서 차용**: 컬러 base, typography (Geist), spacing scale, 미세 border 처리

### 2. **Stripe** (stripe.com) — 그라디언트 액센트

| 요소 | 시그니처 |
|---|---|
| **그라디언트 mesh** | hero 배경의 흐르는 다중 컬러 mesh (purple/pink/blue/cyan 부드럽게 섞임) |
| **컬러** | indigo (`#635bff`) 메인 + soft gradient stops |
| **타이포** | Sohne (유료) — 우리는 Geist 로 대체 |
| **레이아웃** | 매우 풍부한 여백 + serif 부제목 (선택) |
| **개성** | 따뜻하고 신뢰, "프리미엄 SaaS" |

→ **fos-blog 에서 차용**: hero 그라디언트 mesh (홈/글 상세 페이지 hero), 액센트 컬러의 부드러운 섞임

### 3. **Linear** (linear.app) — 미세 디테일

| 요소 | 시그니처 |
|---|---|
| **컬러** | 짙은 보라/검정 (`#1a1a2e`) + 핫 핑크/오렌지 액센트 |
| **타이포** | Inter Display (큰 hero 텍스트 묵직) |
| **레이아웃** | 비대칭 그리드 + 큰 hero 텍스트 + 흐르는 인터랙션 |
| **개성** | 빠르고 매끄러운, 살짝 미래적 |

→ **fos-blog 에서 차용**: hero 큰 텍스트 처리 + 일부 모션 디테일 (page transition)

---

## fos-blog 컨텍스트

| 항목 | 값 |
|---|---|
| **사이트** | https://blog.fosworld.co.kr |
| **타입** | 한국어 개발 학습 블로그 (1인 운영) |
| **콘텐츠** | 약 200개 마크다운 글 (`jon890/fos-study` GitHub sync) |
| **주제** | AI, 알고리즘, DB, DevOps, Java/Spring, JavaScript/TypeScript, React, Next.js |
| **타겟** | 한국어권 개발자 |
| **운영자** | jon890 (개인 개발자) |
| **수익화** | Google AdSense (승인 진행 중) |
| **현재 톤** | Generic Tailwind look (gray + blue + rounded-xl) — 정체성 부족 |

---

## 기술 제약 (Claude Design 산출물이 따라야 할 것)

- **Framework**: Next.js 16 App Router, Tailwind v4
- **컴포넌트 base**: shadcn/ui 최신 (Tailwind v4 호환)
- **폰트**:
  - 영문 UI/본문: **Geist Sans** (`geist` npm)
  - 영문 코드: **Geist Mono**
  - 한글: **Pretendard** (CDN)
- **모션**: motion-one (~3KB, Framer Motion 경량 alt)
- **다크 우선**: default dark (Vercel/Linear 컨벤션)
- **접근성**: WCAG AA 이상, focus-visible ring 일관
- **반응형**: mobile-first

---

## 현재 디자인 문제점 (개선 대상)

1. 시각적 정체성 부족 (generic Tailwind look)
2. 로고 = 📚 이모지 (브랜드 약함)
3. 타이포그래피 평이 (h1~h4 사이즈 격차 작음)
4. 카드/카드 padding 일관성 부족
5. 컬러 토큰 정의는 있으나 실제 미사용 (`bg-blue-600` 직접)
6. shadcn/ui 미사용 — 모든 UI 자체 구현
7. Hero 단조 (그라디언트 blob + 텍스트만)
8. PostCard 가로형 — 데스크탑 정보 밀도 낮음
9. footer 비어보임
10. 여백 시스템 없음 (mb-8 / mb-16 mix)
11. 글 본문 가독성 평이 (prose 만)
12. 카테고리 색상 dot 작음
13. 인터랙션 단조

---

## Claude Design 프롬프트 (단계별)

> 사용자가 Claude Design 별도 세션에 아래 프롬프트를 순서대로 붙여 사용. 각 단계 결과를 보고 iteration 후 다음 단계.

---

### 📝 프롬프트 #1 — 디자인 시스템 토큰

```
저는 fos-blog 라는 한국어 개발 학습 블로그를 모던 dev-tool 스타일로
리디자인하고 싶습니다.

# 컨텍스트
- 사이트: https://blog.fosworld.co.kr (Next.js 16, Tailwind v4)
- 타입: 1인 운영 한국어 개발 학습 블로그, 약 200개 마크다운 글
- 주제: AI, 알고리즘, DB, DevOps, Java/Spring, JS/TS, React, Next.js
- 타겟: 한국어권 개발자
- 다크 우선 (default dark)

# 톤 베이스
- Vercel (vercel.com) 의 절제되고 정확한 베이스 — pure black/white,
  Geist 폰트, 미세 그리드 라인, 작은 radius, 1px border
- Stripe (stripe.com) 의 부드러운 다중 컬러 그라디언트 mesh 를
  hero 영역에만 액센트로
- Linear (linear.app) 의 큰 hero 텍스트 처리는 일부만 차용

# 폰트 스택 (확정됨)
- 영문 UI/본문: Geist Sans
- 영문 코드: Geist Mono
- 한글: Pretendard
- → 폰트 자체는 변경 불가. 사이즈 / weight / line-height / letter-spacing 만 정의

# 요청
**디자인 시스템 토큰** 을 정의해주세요:

1. **컬러 팔레트**
   - background (dark base, light base — 양쪽 다)
   - foreground (text primary/secondary/muted)
   - border (subtle, default, strong)
   - **brand primary** (Vercel-like base — 시안/블루 계열 1~2개)
   - **gradient mesh accent** (Stripe-like — hero 영역에만 사용할 4~6 stops)
   - 카테고리별 미묘한 색 (AI/알고리즘/DB/DevOps/Java/JS/React 등 9개)
   - semantic (success/warning/error/info)
   - 모든 값은 hex 또는 oklch 형식. dark/light 양쪽 모두

2. **타이포그래피 스케일**
   - h1 (display): 한글 미적 + 영문 Geist 균형
   - h2/h3/h4: 명확한 hierarchy
   - body / body-large / small / micro
   - code (Geist Mono)
   - line-height, letter-spacing, font-weight 모두 명시

3. **Spacing scale**
   - 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128 (Tailwind 기본 + 추가)
   - 컴포넌트 padding 표준 (sm/md/lg)
   - 섹션 간 표준 (mb 값)

4. **Radius**
   - none / sm / default / md / lg / full

5. **Shadow**
   - 다크모드와 라이트모드 각각의 elevation (subtle / default / popover / modal)

6. **Motion primitives**
   - duration: instant (75ms) / fast (150ms) / default (250ms) / slow (400ms)
   - easing: ease-out (default) / spring / linear

# 출력 형식
- 시각적 swatch (각 토큰의 실제 모습)
- Tailwind v4 의 @theme 블록 형태로 코드 (CSS variables)
- 토큰 이름은 시맨틱 (--color-bg, --color-fg-muted 같이)

이 토큰이 이후 컴포넌트/페이지 mockup 의 기반이 됩니다.
```

---

### 📝 프롬프트 #2 — 핵심 컴포넌트

> 프롬프트 #1 결과를 첨부하거나 토큰 표를 같이 보내며 사용.

```
프롬프트 #1 에서 확정된 토큰을 사용해, fos-blog 의 핵심 컴포넌트 6개의
mockup 을 만들어주세요.

# 컴포넌트 목록

1. **Header** (sticky, 64px 높이)
   - 로고: "FOS Study" (현재 📚 이모지는 제거 — 더 sophisticated 하게)
   - 네비게이션: 홈 / 카테고리
   - 우측: 검색 (⌘K hint), GitHub 링크, 테마 토글, 사이드바 토글
   - 모바일: 햄버거 메뉴
   - 다크/라이트 모두

2. **Footer** (현재 3-column 비어보임 — 4-column 구성)
   - Brand: 로고 + 한 줄 설명
   - 바로가기: 홈, 카테고리, 최신 글, 인기 글
   - 정책: 소개, 개인정보처리방침, 연락처
   - 소셜: GitHub, Source Repository
   - 하단: VisitorCount + © 표기

3. **PostCard** (글 1개 카드)
   - 현재 가로형 (아이콘+제목+카테고리 dot+chevron) — 데스크탑 정보 밀도 부족
   - 새 디자인: 카테고리 visual prominence + 제목 가독 + 발췌 1~2줄 (선택)
   + + 메타 (조회수, 작성일)
   - 카테고리별 색상 시각 신호 (현재 dot 보다 강하게)

4. **CategoryCard** (카테고리 그리드의 1개 카드)
   - 카테고리명 + 글 수 + 미세 아이콘
   - hover 시 동적 인터랙션

5. **Hero (홈)**
   - "FOS Study — 개발 학습 블로그" 큰 텍스트
   - 부제: "AI · Algorithm · Database · DevOps · ..."
   - **Stripe 의 그라디언트 mesh** 를 배경에 (이번에 정의한 gradient accent 토큰 사용)
   - CTA 버튼은 따로 없음 (블로그라 콘텐츠로 직접 진입 유도)

6. **Section CTA Button** (홈 "최신 글 더 보기" / "인기 글 더 보기")
   - 큰 버튼, 주 액션
   - hover 미세 motion

# 제약
- shadcn/ui 컴포넌트 base 활용 가능 (Button, Card, Tooltip 등)
- 모션은 motion-one — 짧고 미세하게
- 한글 텍스트 가독성 (Pretendard 적용 가정) 우선
- 다크/라이트 모두

# 출력 형식
- 각 컴포넌트의 시각적 mockup (다크/라이트 각각)
- 핵심 spacing/border/color 결정 메모
- 인터랙션 (hover/focus/active) 상태 별도 표기
- HTML/JSX snippet (선택, 있으면 좋음)
```

---

### 📝 프롬프트 #3 — 핵심 페이지

> 프롬프트 #1, #2 결과 첨부 후 사용.

```
프롬프트 #1 (토큰), #2 (컴포넌트) 결과를 사용해 페이지 3개의 mockup 을
만들어주세요.

# 페이지 1: 홈 (/)
구성:
- Header (sticky)
- Hero (Stripe gradient mesh 배경 + 큰 타이포)
- 카테고리 섹션 (9개 canonical 카테고리 grid, "모두 보기 →" 헤더 우측 링크)
- 인기 글 섹션 (PostCard × 6, "인기 글 더 보기 →" CTA 버튼 하단)
- 최근 글 섹션 (PostCard × 6, "최신 글 더 보기 →" CTA 버튼 하단)
- 통계 섹션 (카테고리 수 / 전체 글 수 / "계속 성장 중" 3-card)
- Footer

데스크탑(1280px) + 모바일(375px) 양쪽.

# 페이지 2: 글 상세 (/posts/<path>)
구성:
- Header
- 본문 영역 (좌측 main + 우측 TOC sidebar)
  - 카테고리 배지 + "/ 서브카테고리"
  - 글 제목 (h1, display 스케일 — 매우 크게)
  - 메타 정보 (읽기 시간, 작성일, 수정일, 조회수, GitHub 링크)
  - 본문 (Markdown 렌더 영역, prose 스타일 — 한글 가독성 핵심)
  - 본문 끝 footer (카테고리 다른 글 링크 + "GitHub 수정 제안")
  - 댓글
- Footer

본문 가독성 핵심:
- 단락 사이 충분한 여백
- 코드 블록 (Geist Mono, 다크 배경)
- 인용구 (좌측 border + 살짝 다른 배경)
- 이미지 자연스럽게 (rounded + 미묘한 shadow)
- inline code (핑크 액센트는 유지하되 톤 조정)

# 페이지 3: 카테고리 폴더 (/category/<path>)
구성:
- Header
- breadcrumb
- 카테고리 헤더 (큰 아이콘 + 이름 + 글 수)
- README (있으면 Markdown 렌더)
- 하위 폴더 grid
- 글 리스트 (PostCard 세로 stack)
- Footer

# 출력 형식
- 각 페이지의 mockup (다크/라이트, 데스크탑/모바일)
- 핵심 결정 노트 (어떤 spacing, 어떤 typography choice 의 이유)
- 컴포넌트 #2 와 일치하도록
```

---

## 사용자 워크플로우

1. **이 파일을 사용자가 읽음** → fos-blog 의 컨텍스트 + 톤 + 제약 + 프롬프트 미리 파악
2. **Claude Design 별도 세션 열기** (claude.ai/design 또는 데스크탑 앱)
3. **프롬프트 #1 붙여넣기** → 토큰 결과 받음 → 검토 → iteration
4. **프롬프트 #2 붙여넣기** (#1 결과 첨부) → 컴포넌트 mockup → iteration
5. **프롬프트 #3 붙여넣기** (#1, #2 결과 첨부) → 페이지 mockup → iteration
6. **결과를 이 저장소에 가져옴**
   - 이미지: `docs/design-mockups/` 디렉터리에 저장
   - HTML/JSX snippet: 각 plan 의 phase 프롬프트에 인용
   - 토큰 hex 값: plan008 task 의 입력
7. **plan008~013 순차 구현** — Claude Code (이 세션) 가 mockup 을 코드로 구현

---

## 기대 산출물 (Claude Design → 이 저장소 핸드오프)

| 파일 | 내용 |
|---|---|
| `docs/design-mockups/tokens.png` (또는 .pdf) | 토큰 swatch + 계층 |
| `docs/design-mockups/components/` | Header, Footer, PostCard 등 mockup |
| `docs/design-mockups/pages/` | 홈, 글 상세, 카테고리 mockup |
| `docs/design-tokens.css` (선택) | Claude Design 이 산출한 Tailwind v4 `@theme` 블록 |

이후 plan008 의 phase 프롬프트가 위 자료를 참조하며 구현.

---

## 참고

- Claude Design Research Preview: https://www.anthropic.com/news/claude-design-anthropic-labs
- Vercel 디자인 시그니처: https://vercel.com / https://nextjs.org
- Stripe 그라디언트 mesh: https://stripe.com (홈 hero 참조)
- Linear 미세 디테일: https://linear.app
- shadcn/ui (Tailwind v4 호환): https://ui.shadcn.com
- Geist 폰트: https://vercel.com/font
- Pretendard: https://pretendard.dev
- motion-one: https://motion.dev

---

## Claude Design Handoff Bundles (실측)

### Round 1 — 디자인 시스템 토큰 (2026-04-25)

- URL: `https://api.anthropic.com/v1/design/h/J72HSJyKRHwlb3S4Yjmk6w?open_file=fos-blog+Design+Tokens.html`
- 로컬: `~/.claude/projects/.../tool-results/webfetch-1777097520807-wx9in3.bin` (gzip tar, 24.6KB)
- 핵심 파일: `tokens.js` (source of truth), `styleguide.css` (CSS 변수 패턴 + Density)
- → **plan009-design-tokens-foundation** 으로 적용 (이 플랜 파일: `~/.claude/plans/hidden-moseying-charm.md`)

### Round 2 — 컴포넌트 mockup (2026-04-25)

- URL: `https://api.anthropic.com/v1/design/h/mFKhF4UX1SITpFy5jE7QTw?open_file=fos-blog+Components.html`
- 로컬: `~/.claude/projects/.../tool-results/webfetch-1777098410179-5850mb.bin` (gzip tar, 45.7KB)
- 핵심 파일: `components-1.jsx`, `components-2.jsx`, `components.css`, `design-canvas.jsx`, `fos-blog Components.html`
- **3 컴포넌트 × 다중 variants** (Round 1 토큰 기반):
  - **Article Page** (3): Default(hero mesh + sticky TOC + reading progress + 카테고리 태그 + author) / Narrow reading(TOC 제거, 본문 폭 축소) / Light parity
  - **Card List** (4): Editorial row list(번호+제목+발췌+카테고리+메타, 밀도 高) / Card grid(mesh placeholder cover + 카테고리 dot) / Terminal feed(`$ ls -la` REPL, caret blink) / Row list light parity
  - **Code Block** (3): Default(filename header + 라인번호 + 라인 하이라이트 + copy) / Diff(semantic +/−) / Terminal(traffic-lights + build output + caret blink)
- 카테고리 9색은 hue 만 변형, chroma·lightness 통일
- **추출**: `tar xzOf <bin> 'fos-blog/project/components-1.jsx' > /tmp/components-1.jsx`

### plan010 이상 분할 (제안)

- **plan010**: 카테고리 매핑 헬퍼 (architecture/network/interview/kafka/internet → system/default) + PostCard / CategoryCard 리디자인 (Editorial row list 베이스, Card grid 옵션은 별도 변형)
- **plan011**: Article page redesign (글 상세 — hero mesh + sticky TOC + reading progress bar)
- **plan012**: Code Block (MarkdownRenderer 의 pre 처리 — filename header + line numbers + copy + diff/terminal variants)
- **plan013**: Header + Footer + Hero (홈) redesign
- **plan014**: Density 토글 + 사이드바 + 검색 (shadcn Sheet/Dialog)
- **plan015**: motion-one 마이크로 인터랙션
- → **권장**: 각 plan 시작 전 별도 plan mode 세션에서 components.* 파일 추출/분석 → plan 작성 → build-with-teams 실행
