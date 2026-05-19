# Phase 03 — 회귀 테스트 + 통합 검증 + index.json completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

Lightbox 컴포넌트의 핵심 인터랙션 (open/close/keyboard nav) 을 Vitest 로 회귀 보호하고, lint/type-check/build/test 전체 통과를 검증한다.
마지막 phase 표준에 따라 `tasks/plan039-image-lightbox/index.json` 의 status 를 모두 `completed` 로 마킹.

**범위 외**: 컴포넌트/통합 변경 (phase 01-02).

---

## 작업 항목 (4)

### 1. `src/components/lightbox/LightboxProvider.test.tsx` — open/close/keyboard 회귀

Vitest + @testing-library/react. 다음 케이스:

```tsx
describe("LightboxProvider", () => {
  it("LightboxImage 클릭 시 lightbox 가 열린다", async () => {
    // Provider 안에 LightboxImage 2개 mount
    // 첫 이미지 클릭 → role="dialog" 가 렌더되는지
  });

  it("ESC 키로 닫힌다", async () => {
    // 열린 상태에서 keydown(Escape) → dialog 사라짐
  });

  it("ArrowRight / ArrowLeft 로 prev/next 전환", async () => {
    // 3개 이미지 mount, 1번에서 시작 → ArrowRight 후 2번, ArrowLeft 두 번 후 3번 (wrap-around)
    // 카운터 텍스트 "1 / 3" / "2 / 3" / "3 / 3" 검증
  });

  it("이미지 1장만 있으면 prev/next 버튼/카운터 미렌더", async () => {
    // LightboxImage 1개. 클릭 → dialog 열림, "ChevronLeft"/"ChevronRight" aria-label 0건
  });

  it("배경 클릭 시 닫힌다", async () => {
    // dialog 영역 외 클릭 (currentTarget === target) → 닫힘
  });

  it("linked image (`<a><LightboxImage/></a>`) 클릭 시 lightbox 미오픈", async () => {
    // <a href="..."><LightboxImage src=".." alt=".." /></a> 구조 mount
    // 이미지 클릭 → role="dialog" 가 렌더되지 않음 (링크 네비게이션 우선)
    // closest("a") 가드 동작 검증
  });
});
```

next/image mock 필요시 vitest config 의 setup 파일 또는 `vi.mock("next/image", () => ({ default: (props) => <img {...props} /> }))` 인라인.

JSDOM 의 querySelectorAll 동작 확인 — Provider 의 articleRef 가 children 의 `[data-lightbox-image]` 를 잡는지 실측.

### 2. 통합 검증 명령

```bash
# cwd: <repo root>
pnpm lint          # exit 0
pnpm type-check    # exit 0
pnpm test --run    # 전체 통과 + 위 5케이스 PASS
pnpm build         # standalone 빌드 성공

# 잔재 점검
grep -rnE "next/image" src/components/markdown/components.tsx
# img 컴포넌트가 LightboxImage 로 교체됐으면 0건 (단 파일 내 다른 컴포넌트가 Image 쓰는 경우 OK — 확인 후 판정)

# Lightbox 컴포넌트 모두 "use client"
grep -L '"use client"' src/components/lightbox/*.tsx | wc -l
# 기대: 0 (전부 client)

# 신규 테스트 파일 존재 + 케이스 수
ls src/components/lightbox/*.test.tsx
grep -c "it(" src/components/lightbox/LightboxProvider.test.tsx
# 기대: ≥ 6 (open/close/keyboard nav/wrap-around/single-image/linked-image)
```

### 3. 수동 smoke (Critic 가 확인할 수 없음 — executor 가 명시 보고)

`pnpm dev` 후:
- `/posts/<이미지 ≥ 2장 글>` 에서 본문 이미지 클릭 → lightbox open. backdrop 다크/라이트 자연
- ESC / 배경 클릭 / 우상단 X / 좌우 버튼 / ←→ 키 5가지 모두 동작
- 카운터 "N / total" 정확
- 인접 ±1 prefetch — DevTools Network 탭에서 open 직후 인접 이미지 fetch 확인 (이미지 ≥ 3장 글 기준)
- 다크/라이트 mode 토글 양쪽 backdrop / 컨트롤 가독성

위 항목 모두 PASS 여부를 SendMessage 본문에 명시.

### 4. `tasks/plan039-image-lightbox/index.json` status 마킹

마지막으로 모든 status 를 completed 로:

```bash
sed -i '' 's/"status": "pending"/"status": "completed"/g' tasks/plan039-image-lightbox/index.json
grep -c '"status": "completed"' tasks/plan039-image-lightbox/index.json
# 기대: 4 (1 root + 3 phases)
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/components/lightbox/LightboxProvider.test.tsx` | 신규 |
| `tasks/plan039-image-lightbox/index.json` | status 마킹 (in_progress → completed) |

## 검증

위 "통합 검증 명령" 블록을 그대로 실행. 모두 exit 0 + grep 기대값 충족 시 PASS.

## 의도 메모 (왜)

- **회귀 테스트 6케이스**: open/close/keyboard/wrap-around/single-image-edge/linked-image — lightbox 의 핵심 인터랙션 모두 커버. 향후 lightbox 동작 변경 시 회귀 즉시 감지
- **next/image mock**: JSDOM 에 native Image 호환 없음 + next/image SSR 분기 노이즈 — 단순 `<img>` 로 mock 이 테스트 의도에 충분
- **수동 smoke 명시 보고**: dev server smoke 는 critic 가 자동 검증 못 함. executor 의 명시적 PASS 회신이 docs-verifier 의 marker
