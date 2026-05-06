# Phase 01 — OG 이미지 plan009 반영

**Model**: sonnet
**Goal**: OG 이미지 (글 상세 + 카테고리) 의 폰트 / 색상 / 카테고리 badge 를 plan009 디자인 시스템 기반으로 재구성.

## Context (자기완결)

`src/app/api/og/posts/[...slug]/route.tsx` + `src/app/api/og/category/[...path]/route.tsx` 두 라우트가 `next/og` 의 `ImageResponse` (satori 기반) 로 OG 이미지를 렌더링한다. 색/폰트/레이아웃 상수는 `src/lib/og.ts` 에 모여 있다.

**현재 상태 (plan009 단절)**:
- 폰트: `Noto Sans KR Bold subset` (`public/fonts/NotoSansKR-Bold-subset.ttf`)
- 배경: 자주색 그라디언트 `linear-gradient(135deg, #1e1b4b 0%, #3b82f6 50%, #8b5cf6 100%)`
- 카테고리 badge: 단일 흰색 반투명 (`rgba(255,255,255,0.12)`)

**목표 (사용자 결정 — 2026-05-06)**:
- 폰트: **Pretendard Bold** (한글 위주, plan009 fallback chain 의 핵심)
- 배경: **단색 다크 베이스 (`#000000` = bg-base) + brand teal accent** (Vercel/Linear 톤)
- 카테고리 badge: **9개 카테고리별 plan009 토큰 색** (oklch → hex 사전 변환)

**제약 — satori 의 한계**:
- oklch / lab / color() 미지원 → 모든 색은 **hex 또는 rgb()** 로
- mesh gradient 미지원 (linear/radial 만)
- CSS variable 미지원 → 코드에 직접 hex 박아 넣어야

**플젝 컨벤션**:
- `runtime = "nodejs"` 유지 (satori 가 fs.readFile 사용)
- log: `logger.child({ module: ... })` (이미 적용됨, 그대로 유지)
- 두 라우트는 같은 디자인 베이스 사용 — 공통 상수는 `src/lib/og.ts` 에서 단일 소스
- public/ 의 신규 폰트 자산은 .gitattributes 에 binary 로 등록 (이미 ttf 형태로 추적 중인 패턴 그대로)

## 작업 항목

### 1. Pretendard Bold subset 폰트 자산 추가

`public/fonts/Pretendard-Bold-subset.ttf` 추가. 출처 옵션 (executor 가 택1):

**옵션 A — Pretendard 패키지 npm install + 추출** (권장):
```bash
# cwd: <repo root>
pnpm add -D pretendard
# node_modules/pretendard/dist/web/static/Pretendard-Bold.subset.woff2 또는 .ttf 확인
# .ttf 가 없으면 .woff2 → .ttf 변환 필요 (satori 는 ttf/otf/woff 지원, woff2 미지원)
```

**옵션 B — jsdelivr CDN 다운로드** (간단):
```bash
curl -L -o public/fonts/Pretendard-Bold-subset.ttf \
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/Pretendard-Bold.subset.ttf" \
  || curl -L -o public/fonts/Pretendard-Bold-subset.woff \
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/Pretendard-Bold.subset.woff"
```

ttf 가 없으면 woff 도 satori 호환. 파일이 정상 다운로드 (size > 100KB) 되면 OK.

기존 `NotoSansKR-Bold-subset.ttf` 는 즉시 삭제 — fallback 으로 남길 가치 없음 (plan009 가 Pretendard 기반).

### 2. `src/lib/og.ts` 색상/레이아웃 토큰 갱신

`OG_COLORS` 객체 전체 교체:

```ts
// plan009 dark mode token 의 satori 호환 hex 등가
export const OG_COLORS = {
  // 배경: bg-base 단색 + brand accent grain
  bgBase: "#000000",         // --color-bg-base (dark)
  bgAccent: "#0d0d0f",       // --color-bg-elevated — 미세한 텍스처용 (선택)

  // 텍스트
  textPrimary: "#f4f4f5",    // --color-fg-primary (dark)
  textSecondary: "#a1a1aa",  // --color-fg-secondary (dark)
  textMuted: "#71717a",      // --color-fg-muted (dark)

  // brand
  brand: "#3fbac9",          // --color-brand-400 = oklch(0.78 0.13 195) 의 sRGB hex 근사
  brandSubtle: "rgba(63, 186, 201, 0.12)",
  brandBorder: "rgba(63, 186, 201, 0.3)",

  // 보더
  border: "rgba(255, 255, 255, 0.08)",
} as const;
```

`OG_LAYOUT` 은 유지하되 brand 라인용 추가:

```ts
export const OG_LAYOUT = {
  padding: "80px",
  logoBottom: 24,
  logoLeft: 24,
  logoSize: 48,
  logoBorderRadius: 8,
  brandBarHeight: 4,         // 상단 brand teal 띠
} as const;
```

`loadOgFont()` 갱신:
```ts
export function loadOgFont(): Promise<ArrayBuffer> {
  // Pretendard-Bold-subset.ttf 또는 .woff
  const fontPath = path.join(
    process.cwd(),
    "public/fonts/Pretendard-Bold-subset.ttf"
  );
  // ... (기존 캐시 로직 동일, path 만 교체)
}
```

woff 만 받았다면 path 도 `.woff` 로. 어느 쪽이든 `process.cwd()` 기반 경로.

### 3. 카테고리 hex 매핑 추가 (`src/lib/og.ts`)

plan009 의 oklch 카테고리 토큰을 satori 호환 hex 로 사전 변환. **dark mode 값 기준** (OG 배경이 다크):

```ts
/**
 * plan009 카테고리 토큰의 satori 호환 hex 매핑.
 * 원본은 oklch(0.74 0.09 H) — sRGB 변환은 https://oklch.com/ 또는 culori 라이브러리로 사전 계산.
 * satori 는 oklch 미지원이라 직접 hex 박아 넣음.
 *
 * 카테고리 키는 src/infra/db/constants.ts 의 categoryIcons 와 정렬.
 */
export const OG_CATEGORY_HEX: Record<string, string> = {
  ai: "#b3a4d4",         // oklch(0.74 0.09 285)
  algorithm: "#d4a594",  // oklch(0.74 0.09 25)
  db: "#cdaf85",         // oklch(0.74 0.09 55)
  devops: "#8ec8a8",     // oklch(0.74 0.09 145)
  java: "#7ec5be",       // oklch(0.74 0.09 180)
  js: "#bbb96d",         // oklch(0.74 0.09 90)
  react: "#88b8d6",      // oklch(0.74 0.09 220)
  next: "#d49d99",       // oklch(0.74 0.09 0)
  system: "#9ab0d4",     // oklch(0.74 0.09 250)
};

export const OG_CATEGORY_DEFAULT_HEX = "#3fbac9"; // brand-400 fallback

export function getCategoryHex(category: string): string {
  // src/infra/db/constants.ts 와 같은 normalize 규칙 (lowercase + 별칭)
  const key = category.toLowerCase();
  return OG_CATEGORY_HEX[key] ?? OG_CATEGORY_DEFAULT_HEX;
}
```

**주의**: hex 값은 근사치. executor 는 [oklch.com](https://oklch.com) 에서 각 oklch 값을 입력해 P3 가 아닌 sRGB hex 로 다시 검증해서 박아 넣을 것. 위 값은 1차 근사일 뿐.

기존 `categoryIcons` (src/infra/db/constants.ts) 의 키 목록을 그대로 사용해야 누락 없음 — executor 는 그 파일을 먼저 확인 후 매핑 키 정합 검증.

### 4. 두 라우트 (`route.tsx`) 디자인 갱신

**공통 시각 구조**:
```
┌────────────────────────────────────────────┐
│ ▔▔▔▔▔▔▔▔ (4px brand teal 상단 띠) ▔▔▔▔▔▔▔ │
│                                              │
│  [icon CATEGORY]  ← cat hex tint badge      │
│                                              │
│   타이틀 (Pretendard Bold 72px)               │
│   여러 줄 가능                                │
│                                              │
│   설명 (Pretendard 32px, fg-secondary)        │
│                                              │
│  [logo]                          fos-blog/study  │
└────────────────────────────────────────────┘
```

**post route 변경 사항**:
- 컨테이너 배경: `OG_COLORS.bgBase` 단색
- 상단 4px brand 띠: 절대위치 `top: 0; left: 0; right: 0; height: 4` + `background: OG_COLORS.brand`
- 카테고리 badge:
  - `background: getCategoryHex(category) + "1F"` (12% alpha — hex8 표기 또는 rgba 직접)
  - `border: 1px solid ${getCategoryHex(category)}` 또는 30% alpha
  - `color: getCategoryHex(category)`
- 타이틀: `color: OG_COLORS.textPrimary`
- 설명: `color: OG_COLORS.textSecondary`
- 우하단 워드마크 추가 (선택): `fos-blog/study` 텍스트, brand color 의 `/study` suffix muted
- 폰트 옵션: `[{ name: "Pretendard", data: font, weight: 700, style: "normal" }]`

**category route**:
- post route 와 동일 구조 — 단 description 영역에 카테고리별 한 줄 설명 (예: `${category} — fos-blog 정리 모음`)
- badge 의 카테고리는 path 의 첫 segment 사용

**구현 세부**:
- alpha hex8 (`#3fbac91F`) 가 satori 에서 작동하지 않으면 `rgba(63, 186, 201, 0.12)` 형태로 명시적 변환 헬퍼 사용. `OG_CATEGORY_HEX` 에서 alpha 변형이 필요할 때마다 `rgba` 변환:
  ```ts
  function hexWithAlpha(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  ```
  이 헬퍼도 `src/lib/og.ts` 에 같이 추가.

### 5. `src/lib/og.test.ts` 갱신

기존 `OG_COLORS.bgGradientStart` 등 사라진 키를 참조하는 테스트가 있으면 신규 키 (`bgBase`, `brand`, `textPrimary`) 로 교체. `truncateForOg` / `loadOgFont` / `loadOgLogoDataUrl` 의 테스트는 그대로 유지.

신규 테스트 추가:
- `getCategoryHex("js")` 가 `OG_CATEGORY_HEX.js` 반환
- `getCategoryHex("UNKNOWN")` 가 `OG_CATEGORY_DEFAULT_HEX` 반환
- `hexWithAlpha("#3fbac9", 0.12)` 가 `"rgba(63, 186, 201, 0.12)"` 반환

### 6. 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

자동 verification:
```bash
test -f public/fonts/Pretendard-Bold-subset.ttf || test -f public/fonts/Pretendard-Bold-subset.woff
! test -f public/fonts/NotoSansKR-Bold-subset.ttf
grep -n "Pretendard" src/lib/og.ts
grep -n "OG_CATEGORY_HEX" src/lib/og.ts
grep -n "Noto Sans KR" src/app/api/og/posts/\[...slug\]/route.tsx  # 0줄
grep -n "Noto Sans KR" src/app/api/og/category/\[...path\]/route.tsx  # 0줄
grep -n "bgGradientStart\|bgGradientMid\|bgGradientEnd" src/  # 0줄
```

수동 smoke (사용자 안내):
- `pnpm dev` → 브라우저에서 직접 OG 라우트 접근:
  - `http://localhost:3000/api/og/posts/<있는 글 슬러그>`
  - `http://localhost:3000/api/og/category/<있는 카테고리>`
- 1200×630 PNG 가 새 디자인 (검은 배경 + brand teal 띠 + 카테고리별 색 badge) 으로 렌더링되는지 확인
- 한글 타이틀 가독성 (Pretendard Bold) 확인

### 7. index.json status="completed" 마킹

phase 완료 시 `tasks/plan021-og-image-refresh/index.json` 의 phase 1 + 최상위 `status` 를 `"completed"` 로.

## Critical Files

| 파일 | 상태 |
|---|---|
| `public/fonts/Pretendard-Bold-subset.ttf` (또는 .woff) | 신규 |
| `public/fonts/NotoSansKR-Bold-subset.ttf` | 삭제 |
| `src/lib/og.ts` | 수정 (OG_COLORS 교체 + OG_CATEGORY_HEX + getCategoryHex + hexWithAlpha + loadOgFont path) |
| `src/lib/og.test.ts` | 수정 (신규 키 검증) |
| `src/app/api/og/posts/[...slug]/route.tsx` | 수정 (디자인 + 폰트 name) |
| `src/app/api/og/category/[...path]/route.tsx` | 수정 (디자인 + 폰트 name) |
| `tasks/plan021-og-image-refresh/index.json` | 수정 (status 마킹) |

영향 없음:
- `src/app/posts/[...slug]/page.tsx` 의 `og:image` 메타 — URL 그대로
- `src/app/category/[...path]/page.tsx` — 동일

## Out of Scope

- mesh gradient (satori 미지원, 의미 없는 복잡도)
- 다국어 폰트 fallback (Geist Latin) — Pretendard 가 영문도 커버
- OG 이미지 캐시 정책 변경 (revalidate=60 그대로)
- 카테고리 매핑 정규화 헬퍼 (이미 `categoryIcons` 가 정합 — 거기서 키만 추출)

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| Pretendard subset 에 일부 한글 글리프 누락 (subset 은 KS X 1001 위주) | 누락 글자가 발견되면 full-set Pretendard ttf 로 교체 (~1MB → ~250KB → ~1MB 트레이드오프). 실제 글 제목들에 발생 빈도 낮음 |
| oklch → hex 근사값이 plan009 dark/light 톤과 불일치 | hex 값은 1차 근사 — executor 가 [oklch.com](https://oklch.com) 으로 정확한 sRGB hex 재검증 후 커밋 |
| satori 가 hex8 alpha (`#RRGGBBAA`) 미지원 | `hexWithAlpha()` 헬퍼로 `rgba()` 형태로 강제 변환 — 위 작업 항목 4 마지막 |
| Pretendard 라이선스 (OFL-1.1) — 폰트 파일 재배포 | OFL 은 임베딩/재배포 허용 (조건부 — copyright 표기). 라이선스 텍스트는 npm 패키지 또는 public/fonts/LICENSE.pretendard.txt 로 함께 커밋 |
| 폰트 파일 크기로 .next/standalone 빌드 부피 증가 | subset 약 100~200KB. 영향 미미 |
