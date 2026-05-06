# Phase 01 — SearchDialog UX 마무리

**Model**: sonnet
**Goal**: 기존 `SearchDialog.tsx` 의 plan009 토큰 적용 + UX 보강 (debounce 300ms, 키보드 네비게이션, skeleton).

## Context (자기완결)

`src/components/SearchDialog.tsx` 는 이미 존재하고 동작한다:
- ⌘K / Ctrl+K 단축키 (Header.tsx 에서 핸들링)
- `/api/search?q=&limit=10` 호출 + debounce + 결과 리스트
- ESC 로 닫기, 결과 클릭 → `router.push("/posts/...")`

문제: **plan009 디자인 토큰 미적용** + UX 디테일 부족. 이번 phase 는 컴포넌트 동작 동일하게 유지하면서 시각/인터랙션만 다듬는다.

**플젝 컨벤션**:
- Tailwind v4 + 기존 토큰 (`--color-bg-elevated`, `--color-bg-overlay`, `--color-fg-primary|secondary|muted|faint`, `--color-border-subtle|default|strong`, `--color-brand-400`) 만 사용 — 신규 토큰 정의 금지
- 색상은 `bg-[var(--color-...)]` arbitrary value 패턴
- "use client" 유지
- `console.error` 대신 logger 사용 — **단 SearchDialog 는 client component 라 `console.error` 허용** (project 컨벤션: `src/lib/logger` 의 pino 는 server only)

## 작업 항목

### 1. `src/components/SearchDialog.tsx` 색상 토큰화

기존 하드코딩 색상을 plan009 토큰으로 일괄 교체:

| 기존 | 교체 대상 |
|---|---|
| `bg-white dark:bg-gray-900` (다이얼로그 컨테이너) | `bg-[var(--color-bg-elevated)]` |
| `bg-black/50 backdrop-blur-sm` (백드롭) | `bg-[var(--color-bg-overlay)]/80 backdrop-blur-sm` (overlay 토큰이 없으면 그대로 black/50 유지) |
| `border-gray-200 dark:border-gray-700` | `border-[var(--color-border-subtle)]` |
| `text-gray-400` (placeholder/icon) | `text-[var(--color-fg-faint)]` |
| `text-gray-500 dark:text-gray-400` (보조 텍스트, empty state) | `text-[var(--color-fg-muted)]` |
| `text-gray-900 dark:text-white` (input 텍스트, 결과 제목) | `text-[var(--color-fg-primary)]` |
| `hover:bg-gray-50 dark:hover:bg-gray-800` (결과 hover) | `hover:bg-[var(--color-bg-subtle)]` |
| `bg-gray-100 dark:bg-gray-700` (카테고리 chip) | `bg-[var(--color-bg-subtle)]` + `text-[var(--color-fg-secondary)]` |
| `bg-gray-100 dark:bg-gray-800` (kbd) | `bg-[var(--color-bg-subtle)] text-[var(--color-fg-secondary)] border border-[var(--color-border-subtle)]` |
| `rounded-xl shadow-2xl` (다이얼로그) | `rounded-[12px] shadow-[var(--shadow-modal)]` (shadow-modal 토큰 없으면 `shadow-2xl` 유지) |

**확인 명령**:
```bash
# cwd: <repo root>
grep -nE "bg-white|bg-gray-|text-gray-|border-gray-" src/components/SearchDialog.tsx
# 결과 0줄이어야 함
```

### 2. debounce 300ms

`SearchDialog.tsx:48-54` 의 `setTimeout(performSearch, 1000)` 을 **300ms** 로 변경. 매직 넘버는 컴포넌트 상단 상수로 추출:

```tsx
const SEARCH_DEBOUNCE_MS = 300;
```

이유: 기존 1000ms 는 사용자가 "검색이 느리다" 라고 체감. 300ms 는 typeahead 표준값.

### 3. 키보드 네비게이션 (↑↓/Enter)

새 state `selectedIndex: number` 추가 (기본 -1, 결과 변경 시 0 으로 리셋).

`useEffect` 에서 ESC 핸들러 옆에:
- `ArrowDown`: `selectedIndex` 를 `(prev + 1) % results.length` 로 (clamp). `e.preventDefault()`
- `ArrowUp`: `(prev - 1 + length) % length`
- `Enter`: `selectedIndex >= 0` 이면 `handleResultClick(results[selectedIndex].path)` 호출

각 결과 `<button>` 에:
- `data-selected={idx === selectedIndex}` 또는 className 분기로 hover 동일 시각 강조 (`bg-[var(--color-bg-subtle)]` 또는 `bg-[var(--color-brand-400)]/10`)
- 마우스 hover 시 `setSelectedIndex(idx)` 동기화 (마우스/키보드 통합 UX)

`results` 가 새로 fetch 되면 `setSelectedIndex(0)`. 빈 결과면 `-1`.

선택된 항목이 viewport 밖이면 `scrollIntoView({ block: "nearest" })` (ref 배열 또는 `useRef + useEffect` 활용). 결과 10개 한정이라 단순 구현 OK.

### 4. 결과 skeleton

빈 쿼리 / 로딩 / 결과 / 빈 결과 4 상태:

| 상태 | 현재 | 변경 |
|---|---|---|
| 빈 쿼리 (`!query`) | "제목, 내용, 설명에서 검색합니다." 안내 | 그대로 — 단 kbd 색만 토큰화 |
| 로딩 (`isLoading && !results.length`) | 헤더 spinner 만 (결과 영역 빈칸) | **skeleton row 3개 추가** — `<li>` 안에 `bg-[var(--color-bg-subtle)] animate-pulse h-12 rounded` 더미 |
| 결과 있음 | 그대로 (토큰만 교체) | + 키보드 selected highlight |
| 빈 결과 | "검색 결과가 없습니다." | 그대로 — 색만 토큰화 |

skeleton 표시 조건: `isLoading && results.length === 0 && query.trim()`. 이전 결과를 유지하며 새 검색 중일 때는 기존 결과 위에 spinner 만 (현재 동작 유지).

### 5. 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

자동 verification:
```bash
# 토큰화 완료 확인
! grep -nE "bg-white|bg-gray-|text-gray-|border-gray-|dark:bg-gray|dark:text-gray|dark:border-gray" src/components/SearchDialog.tsx

# debounce 300
grep -n "SEARCH_DEBOUNCE_MS\s*=\s*300" src/components/SearchDialog.tsx

# 키보드 네비 추가
grep -n "ArrowDown\|ArrowUp\|selectedIndex" src/components/SearchDialog.tsx

# skeleton
grep -n "animate-pulse" src/components/SearchDialog.tsx
```

수동 smoke (사용자 안내, executor 직접 수행 X):
- `pnpm dev` → ⌘K 로 열고
  - 다크/라이트 양쪽에서 색이 plan009 톤과 일관되는지 확인
  - 한글 입력 후 300ms 안에 결과 나오는지
  - ↑↓ 로 선택 이동, Enter 로 글 이동 동작
  - 결과 없을 때 / 검색 중일 때 / 결과 있을 때 시각 상태 자연스러운지

### 6. index.json status="completed" 마킹

phase 완료 시 `tasks/plan020-search-dialog-polish/index.json` 의 phase 1 + 최상위 `status` 를 `"completed"` 로 변경.

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/components/SearchDialog.tsx` | 수정 (토큰화 + UX 보강) |
| `tasks/plan020-search-dialog-polish/index.json` | 수정 (status 마킹) |

영향 없음:
- `src/components/Header.tsx` — `<SearchDialog>` 호출부 props (`isOpen`/`onClose`) 시그니처 동일, 변경 불필요
- `src/app/api/search/route.ts` — API 동작 그대로

## Out of Scope

- shadcn Dialog 도입 (focus trap, portal) — 현재 구현 충분
- cmdk 라이브러리 도입 — 결과 규모 작아 자체 구현 충분
- 카테고리 필터 / 최근 검색어 / 검색 결과 하이라이트 — 후속 plan 후보
- 모바일 최적화 (현재 input autoFocus 가 모바일 키보드 자동 띄움 — 그대로 유지)

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| 토큰 교체 후 다크/라이트 한쪽이 가독성 떨어짐 | 변경 전후 두 모드 모두 수동 확인. `--color-bg-elevated` / `--color-fg-primary` 는 plan009 에서 양쪽 정의됨 |
| 키보드 네비와 마우스 hover 가 충돌 (둘 다 selectedIndex 변경) | 마우스 hover 시 `setSelectedIndex(idx)` 로 동기화 — 키보드 ↑↓ 기준값이 마지막 마우스 hover 위치 |
| 디바운스 단축으로 API 부하 증가 | 검색 결과 캐시 없음 — 기존 1초 → 300ms 도 한 사람당 초당 ~3회 한계. 백엔드 부하 무시 가능 (rate limit 1000/min/IP 적용 중) |
| `--color-bg-overlay` 토큰이 globals.css 에 없으면 backdrop 색이 깨짐 | 변경 전 `grep "--color-bg-overlay" src/app/globals.css` 확인. 없으면 `bg-black/50` 유지 (기존 동일) |
