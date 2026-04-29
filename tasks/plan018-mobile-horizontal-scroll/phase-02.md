# Phase 02 — DevTools 모바일 smoke + Lighthouse + index.json status=completed

**Model**: haiku
**Status**: pending

---

## 목표

phase 01 의 위젯별 방어가 실제 모바일 (375px) 에서 가로 스크롤을 차단하는지 검증. Lighthouse 점수 회귀 없음 확인. plan 완료 마킹.

---

## 작업 항목 (3)

### 1. DevTools 모바일 뷰 수동 smoke

`pnpm dev` 후 Chrome DevTools Device Toolbar (Cmd+Shift+M) 열고 **iPhone SE (375 × 667)** 또는 **Galaxy S8+ (360 × 740)** 프리셋 선택. 다음 페이지에서 가로 스크롤 부재 확인:

- `/` (홈) — HomeHero stat dl 1 컬럼, HeroMesh contained
- `/categories` (있으면) — CategoryCard grid
- `/category/Java` (DB 에 데이터 있을 때) — folder grid + posts list
- `/posts/{slug}` (DB 데이터) — 글 본문 + 코드 블록
  - 매우 긴 inline code 가 wrap 되는지
  - CodeCard 의 가로 스크롤이 **카드 내부에서만** 발생 (페이지 전체 스크롤 X)

검증 명령 (DevTools Console):
```js
({
  iw: window.innerWidth,
  docSW: document.documentElement.scrollWidth,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
})
```
모든 페이지에서 `overflow === 0` 이어야 함.

**오프 가드** (가로 스크롤 잡혔을 때):
```js
// 폭 초과 위젯 식별
[...document.querySelectorAll("*")].filter(e => e.getBoundingClientRect().width > window.innerWidth).slice(0,5).map(e => ({tag: e.tagName, cls: e.className, w: e.getBoundingClientRect().width}))
```

### 2. Lighthouse 회귀 점검

CI 의 `.github/workflows/lighthouse.yml` 가 PR 단위로 자동 실행 (Performance ≥ 90, Accessibility ≥ 95). PR 체크 결과 확인.

수동 실행 (선택):
```bash
pnpm build
pnpm exec lhci autorun  # lhci 설치돼 있으면
```

phase 01 의 추가 CSS 는 paint cost 영향 미미 — 회귀 가능성 낮음. 그래도 점수 회귀 시 `.prose` 규칙의 specificity 또는 `:where(code)` 의 영향 검토.

### 3. `tasks/plan018-mobile-horizontal-scroll/index.json` status="completed" 마킹

```bash
# cwd: <repo root>
python3 -c '
import json, pathlib
p = pathlib.Path("tasks/plan018-mobile-horizontal-scroll/index.json")
d = json.loads(p.read_text())
d["status"] = "completed"
for ph in d["phases"]:
    ph["status"] = "completed"
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
'

jq -r '.status, .phases[].status' tasks/plan018-mobile-horizontal-scroll/index.json
# 출력: completed / completed / completed
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `tasks/plan018-mobile-horizontal-scroll/index.json` | status=completed 마킹 |

## 검증

```bash
pnpm lint && pnpm type-check && pnpm test --run && pnpm build
jq -r .status tasks/plan018-mobile-horizontal-scroll/index.json   # = completed
```

## 의도 메모

- **별도 검증 phase 분리** 이유: phase 01 이 위젯별 변경 + 4 작업 항목으로 작업 단위 큼. 검증은 모바일 수동 smoke + Lighthouse 자동으로 분리 (haiku, 코드 변경 없음)
- **수동 smoke 의 의의**: 모바일 가로 스크롤은 단위 테스트로 검증 어려움 (Playwright/Chromatic 없음). DevTools 모바일 프리셋 + scrollWidth 측정이 최소 검증. plan 미래에 visual regression 도입 고려
