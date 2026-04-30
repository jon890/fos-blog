# Phase 01 — ReadingProgressBar + MobileTocButton + TOC H3 nesting

**Model**: sonnet
**Goal**: 글 상세 페이지 TOC 사용자 경험 마무리 — 상단 진행률 띠 + 모바일 floating 목차 + H3 들여쓰기.

## Context (자기완결)

`src/app/posts/[...slug]/page.tsx` 의 글 상세 페이지에 이미 우측 sticky `<TableOfContents>` 가 들어가 있다 (`md:` breakpoint 이상에서만 노출). 이번 phase 는 세 가지를 추가한다:

1. **ReadingProgressBar**: viewport 최상단에 fixed 1px brand-color 띠. 스크롤 진행률에 따라 width 0→100%
2. **MobileTocButton**: `md` 미만에서만 노출. 우하단 floating circular button → 클릭 시 bottom sheet 로 TOC 표시
3. **TableOfContents H3 nesting**: 현재 `.filter((i) => i.level === 2)` 로 H2 만 표시 중 — H3 도 포함하되 들여쓰기 + 작은 폰트로 nested 표시

**플젝 컨벤션**:
- 신규 컴포넌트는 `src/components/` 직속에 생성 (PascalCase, named export)
- "use client" 필요 (스크롤/IntersectionObserver/state 사용)
- Tailwind v4 + 기존 토큰 (`--color-brand-400`, `--color-bg-elevated`, `--color-fg-*`, `--color-border-subtle`) 만 사용 — 신규 토큰 정의 금지
- 색상은 `bg-[var(--color-...)]` arbitrary value 패턴

## 작업 항목

### 1. `src/components/ReadingProgressBar.tsx` 신규 생성

```tsx
"use client";

import { useEffect, useState } from "react";

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const next = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, next)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      className="fixed left-0 top-0 z-50 h-px w-full bg-transparent"
      role="progressbar"
      aria-label="읽기 진행률"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-[var(--color-brand-400)] transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
```

### 2. `src/components/MobileTocButton.tsx` 신규 생성

- props: `{ toc: TocItem[] }` (TocItem 은 `@/lib/markdown` 에서 import)
- `md:hidden` — 모바일 전용
- 우하단 fixed FAB (예: `fixed bottom-6 right-6 z-40`), 원형, brand-tint 배경 (`bg-[var(--color-brand-400)] text-white`), shadow
- 아이콘: `lucide-react` 의 `List` 사용
- 클릭 → `<dialog>` 또는 단순 fixed overlay 로 bottom sheet 표시 (`role="dialog"`, `aria-modal="true"`)
- bottom sheet:
  - `fixed inset-x-0 bottom-0 z-50` 배경 `bg-[var(--color-bg-elevated)]`
  - 상단 핸들 + 제목 "ON THIS PAGE"
  - max-height 70vh, overflow-y auto
  - TOC 아이템 클릭 시 sheet 닫고 anchor 이동
  - 백드롭 클릭 / ESC / 배경 swipe 로 닫기 (ESC 만 필수, 백드롭은 next best)
- 빈 toc (`toc.length === 0`) 면 button 자체 렌더 안 함

H3 nesting: 데스크톱 TOC 와 동일하게 H3 는 들여쓰기 + 작은 폰트.

### 3. `src/components/TableOfContents.tsx` 수정 — H3 nesting

현재 props 그대로 (`toc: TocItem[]`). 기존 numbered list (01, 02...) 는 H2 에만 적용하고, H3 는:
- 들여쓰기 (`pl-6` 또는 `ml-3`)
- 번호 표시 없음 (또는 더 작은 글씨)
- 폰트 사이즈 `text-[11px]` (현재 12px 보다 한 단계 작게)
- 테두리 색은 동일 brand 토큰 / muted 토큰 그대로

H2 번호 카운트는 H3 를 건너뛰고 H2 끼리만 증가 (기존 `idx + 1` 대신 별도 카운터).

active highlight 로직 (`activeSlug`) 은 H2/H3 모두 적용.

### 4. `src/app/posts/[...slug]/page.tsx` 통합

- `tocItems` 의 `.filter((i) => i.level === 2)` 제거 → `.filter((i) => i.level === 2 || i.level === 3)` 로 교체
- `<ReadingProgressBar />` 를 페이지 최상단 (return 직후, `<ArticleJsonLd>` 이전 또는 나란히) 에 추가
- `<MobileTocButton toc={tocItems} />` 를 `<aside>` 영역 다음 / `<ArticleFooter>` 이전에 추가 (md:hidden 으로 자체 가드)

### 5. 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

수동 smoke (사용자에게 안내, executor 가 직접 수행하지 않음):
- `pnpm dev` → 글 상세 페이지에서:
  - 데스크톱: 상단 1px 진행률 띠 동작, 우측 TOC 에 H3 들여쓰기 표시
  - 모바일 (DevTools 375px): 우하단 FAB 클릭 → bottom sheet 펼침, anchor 이동 동작

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/components/ReadingProgressBar.tsx` | 신규 |
| `src/components/MobileTocButton.tsx` | 신규 |
| `src/components/TableOfContents.tsx` | 수정 (H3 nesting) |
| `src/app/posts/[...slug]/page.tsx` | 수정 (filter + 컴포넌트 mount) |

## Verification (자동)

```bash
test -f src/components/ReadingProgressBar.tsx
test -f src/components/MobileTocButton.tsx
grep -n "ReadingProgressBar" src/app/posts/\[...slug\]/page.tsx
grep -n "MobileTocButton" src/app/posts/\[...slug\]/page.tsx
grep -n "level === 3" src/app/posts/\[...slug\]/page.tsx
! grep -nE 'filter\(\(i\) => i\.level === 2\)' src/app/posts/\[...slug\]/page.tsx
```

## Out of Scope

- 검색 다이얼로그 (G2 / 별도 plan)
- TOC scroll-to-active auto highlight 정밀 튜닝 (현재 IntersectionObserver 그대로 유지)
- 모션/마이크로 인터랙션 라이브러리 도입 — 기본 CSS transition 으로 충분

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| `<dialog>` 요소가 SSR 환경에서 hydration mismatch 유발 | `useEffect` 로 mount 후 portal 또는 ref-based open. 단순 fixed div + state 로 시작 |
| 진행률 바가 reflow 유발 (transition: width) | `will-change: width` + transform-gpu 대안 가능. 시작은 `transition-[width]` 로 충분 |
| H3 가 너무 많은 글에서 TOC 길이 폭증 | 모바일 sheet 는 max-h-70vh + scroll, 데스크톱은 sticky 자체 스크롤. 추가 제한 없음 |
