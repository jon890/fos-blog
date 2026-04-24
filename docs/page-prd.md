# PRD: 글 상세 페이지 — 목차 접기/펼치기 기능

**작성일:** 2026-04-01  
**작성자:** Senior UX Designer (Google/Microsoft 기준 설계)  
**상태:** 확정 → 구현 완료

---

## 1. 문제 정의

현재 글 상세 페이지의 목차(TOC)는 항상 펼쳐진 상태로 고정되어 있다.
긴 글에서 목차 항목이 많아지면 사이드바의 상당 공간을 차지해 본문 읽기에 방해가 될 수 있다.
사용자가 목차를 이미 파악한 이후에는 숨기고 싶을 수 있다.

---

## 2. 목표

- 목차를 접고/펼칠 수 있는 토글 UI를 제공한다.
- 사용자 선택을 기억해 재방문 시 이전 상태를 유지한다.
- 접기/펼치기 전환이 자연스럽고 빠르게 느껴지도록 한다.
- 접근성(키보드, 스크린리더) 표준을 준수한다.

---

## 3. 대상 사용자 및 컨텍스트

| 항목      | 내용                                                           |
| --------- | -------------------------------------------------------------- |
| 대상      | 기술 블로그 독자 (개발자)                                      |
| 디바이스  | 데스크탑(LG 이상) — 현재 모바일은 TOC 미노출                   |
| 읽기 패턴 | 목차로 구조 파악 → 특정 섹션 바로 이동 → 목차 불필요 시 숨기기 |

---

## 4. UX 설계 원칙 (Google/Microsoft 참조)

### 4.1 기본 상태: 펼쳐짐(Open)

목차는 **기본적으로 펼쳐진 상태**로 시작한다.

**근거:**

- 첫 방문자에게 글의 구조를 즉시 노출 (Content-First)
- Google Docs, MDN Web Docs, Microsoft Learn 모두 TOC 기본 오픈
- 숨기는 것은 사용자의 선택 — 강제하지 않는다

예외: localStorage에 `collapsed` 기록이 있으면 그 상태를 복원한다.

### 4.2 토글 인터랙션

**헤더 전체 영역**이 클릭/탭 가능한 버튼이다.

```
┌──────────────────────────────┐
│  📋  목차                 ∧  │  ← 전체 클릭 가능 (full-width button)
├──────────────────────────────┤
│  · 개요                       │
│  · 설치 방법                  │
│      · 의존성 설정             │
│  · 사용 예시                  │
└──────────────────────────────┘
```

- 아이콘: `ChevronDown` / `ChevronUp` (lucide-react, 이미 사용 중)
- 아이콘은 상태 전환 시 180° 회전 애니메이션 (`transition-transform duration-200`)
- 최소 터치 영역: 44px 이상 (Apple HIG / Material Design 기준)

### 4.3 애니메이션

CSS Grid 트릭으로 `height: 0 → auto` 전환을 구현한다.

```
펼쳐짐: grid-template-rows: 1fr
접힘:   grid-template-rows: 0fr
```

- `transition: grid-template-rows 200ms ease`
- JS로 높이를 계산하지 않으므로 리페인트 최소화
- 항목 수와 무관하게 일정한 느낌의 트랜지션

| 상태   | 소요 시간 |
| ------ | --------- |
| 펼치기 | 200ms     |
| 접기   | 200ms     |

200ms는 Nielsen Norman Group 권장 "즉각적 반응" 임계값(≤250ms) 이내다.

### 4.4 상태 유지 (localStorage)

```
key:   "toc-collapsed"
value: "true" | (없음 = 펼쳐짐)
```

- 접을 때 `localStorage.setItem("toc-collapsed", "true")`
- 펼칠 때 `localStorage.removeItem("toc-collapsed")`
- SSR hydration mismatch 방지: 초기 렌더는 항상 펼쳐짐, `useEffect`에서 localStorage 읽어 상태 동기화

### 4.5 접근성

| 항목      | 구현                                            |
| --------- | ----------------------------------------------- |
| 역할      | `<button>` 태그 (또는 `role="button"`)          |
| 상태      | `aria-expanded="true/false"`                    |
| 제어 대상 | `aria-controls="toc-content"`                   |
| 콘텐츠 ID | `id="toc-content"`                              |
| 키보드    | Enter / Space 토글 (`<button>`이므로 기본 제공) |
| 포커스 링 | `focus-visible:ring-2` (Tailwind)               |

---

## 5. 컴포넌트 명세

### `TableOfContents` 변경 사항

| 항목           | 변경 전          | 변경 후                          |
| -------------- | ---------------- | -------------------------------- |
| 헤더           | `<div>`          | `<button>` (role, aria-expanded) |
| Chevron 아이콘 | 없음             | ChevronDown, 회전 애니메이션     |
| 목록 컨테이너  | `<ul>` 직접 노출 | Grid 래퍼 → `overflow-hidden`    |
| 상태           | 없음             | `isCollapsed` (useState)         |
| localStorage   | 없음             | 읽기(useEffect) + 쓰기(토글 시)  |

---

## 6. 비기능 요구사항

| 항목                    | 기준                              |
| ----------------------- | --------------------------------- |
| 번들 크기 증가          | 0 (새 의존성 없음)                |
| Cumulative Layout Shift | 없음 (sticky 포지셔닝 유지)       |
| 서버 컴포넌트 호환      | `"use client"` 유지 (기존과 동일) |
| 다크모드                | 기존 Tailwind dark 클래스 유지    |

---

## 7. 범위 외 (Out of Scope)

- 모바일 TOC 추가: 별도 이슈로 관리
- TOC 항목 클릭 후 자동 접기: 사용자 컨텍스트 유실 우려 → 미구현
- TOC 위치 변경(하단 고정 등): 레이아웃 변경 필요 → 별도 이슈
