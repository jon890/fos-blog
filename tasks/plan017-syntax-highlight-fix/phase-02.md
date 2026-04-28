# Phase 02 — 통합 검증 + Lighthouse smoke + index.json status=completed

**Model**: haiku
**Status**: pending

---

## 목표

phase 01 의 CSS 셀렉터 교체 + 회귀 테스트가 빌드·런타임에서 정상 작동하는지 최종 점검. 코드 변경 없음 — 검증 + 마킹.

---

## 작업 항목 (3)

### 1. 빌드 산출물 검증

```bash
pnpm build

# 빌드 산출물에 새 셀렉터 포함
grep -rE "\.code-card-body pre span" .next/static/css/ 2>/dev/null | head -3

# 이전 셀렉터 (.shiki) 가 빌드 산출물에 남아있지 않아야 함
! grep -rE "html\.dark \.shiki" .next/static/css/ 2>/dev/null

# Lighthouse threshold 자동 검증은 .github/workflows/lighthouse.yml 이 PR 단위로 실행
# Performance ≥ 90, Accessibility ≥ 95 (ADR-017)
```

### 2. 수동 smoke 재확인

phase 01 의 수동 smoke 항목을 한번 더:
- `/posts/...` 코드 블록 색상 (다크 / 라이트 양 모드)
- 코드 블록 line numbers, line-highlight, diff, terminal variant 모두 정상
- 코드 블록 내 inline code (예: `` `const` `` in 본문) 는 `bypassInlineCode: true` 로 처리 안 되므로 plan011 의 `.prose :not(pre) > code` 규칙이 색 처리 — 회귀 없음 확인

### 3. `tasks/plan017-syntax-highlight-fix/index.json` status="completed" 마킹

```bash
# cwd: <repo root>
python3 -c '
import json, pathlib
p = pathlib.Path("tasks/plan017-syntax-highlight-fix/index.json")
d = json.loads(p.read_text())
d["status"] = "completed"
for ph in d["phases"]:
    ph["status"] = "completed"
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
'

# 결과 확인
jq -r '.status, .phases[].status' tasks/plan017-syntax-highlight-fix/index.json
# 출력: completed / completed / completed
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `tasks/plan017-syntax-highlight-fix/index.json` | status=completed 마킹 (이 plan 만) |

## 검증

```bash
pnpm lint && pnpm type-check && pnpm test --run && pnpm build
jq -r .status tasks/plan017-syntax-highlight-fix/index.json   # = completed
```

## 의도 메모

- **별도 검증 phase 분리** 이유: phase 01 이 코드 변경 + 회귀 테스트로 작업 항목 3개. 검증은 build + Lighthouse + 마킹으로 분리해 phase 단위 atomic commit 시 fix vs verify 구분 명확
- **status="completed" 마킹** 은 build-with-teams 의 "사전 검증 3중 체크" 에서 재실행 차단 근거. 누락 시 동일 plan 이 두 번 실행됨
