# Phase 02 — 검증 + index.json completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

phase 01 결과를 grep / lint 로 통합 검증한다. SKILL.md 보강 마커 출현 확인 + 마지막으로 `tasks/plan042-review-fix-ci-reproduce/index.json` 의 status 를 모두 `completed` 로 마킹.

**범위 외**: 새 변경 추가 (phase 01 의 작업).

---

## 작업 항목 (2)

### 1. SKILL.md 보강 마커 grep

```bash
# cwd: <repo root>

# (a) 신규 sub-섹션 헤딩
grep -cE "^### CI 실패 → 로컬 재현" .claude/skills/review-fix/SKILL.md
# 기대: 1

# (b) AskUserQuestion 흐름
grep -cE "AskUserQuestion" .claude/skills/review-fix/SKILL.md
# 기대: ≥ 1

# (c) 실패 체크 → 명령 매칭 표 6 행
grep -cE "^\| .*pnpm (lint|type-check|test|build|db:migrate:runtime|install)" .claude/skills/review-fix/SKILL.md
# 기대: ≥ 6

# (d) "자동 fix 금지" 가드 명시
grep -cE "자동 fix 금지" .claude/skills/review-fix/SKILL.md
# 기대: ≥ 1

# (e) CI 픽스 흐름 도입부 갱신
grep -nE "로컬 재현 결과 반영" .claude/skills/review-fix/SKILL.md
# 기대: 1건 출현

# (f) 신규 sub-섹션이 "CI 실패 흔한 원인 → 해결 표" 와 "CI 픽스 흐름" 사이 위치
LR=$(grep -nE "^### CI 실패 → 로컬 재현" .claude/skills/review-fix/SKILL.md | head -1 | cut -d: -f1)
TBL=$(grep -nE "^### CI 실패 흔한 원인" .claude/skills/review-fix/SKILL.md | head -1 | cut -d: -f1)
FIX=$(grep -nE "^### CI 픽스 흐름" .claude/skills/review-fix/SKILL.md | head -1 | cut -d: -f1)
test "$TBL" -lt "$LR" && test "$LR" -lt "$FIX" && echo "위치 OK" || echo "위치 오류: TBL=$TBL LR=$LR FIX=$FIX"
# 기대: "위치 OK"
```

### 2. 통합 검증 + index.json 마킹

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
# 기대: 둘 다 exit 0 (skill 변경은 ts/lint 영향 0 — sanity check)

# index.json 마킹
sed -i '' 's/"status": "pending"/"status": "completed"/g' tasks/plan042-review-fix-ci-reproduce/index.json
grep -c '"status": "completed"' tasks/plan042-review-fix-ci-reproduce/index.json
# 기대: 3 (1 root + 2 phases)
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `tasks/plan042-review-fix-ci-reproduce/index.json` | status 마킹 (pending → completed) |

## 검증

위 "SKILL.md 보강 마커 grep" + "통합 검증" 블록을 그대로 실행. 모두 exit 0 + grep 기대값 충족 시 PASS.

## 의도 메모 (왜)

- **위치 검증 (f)**: 새 sub-섹션이 의도된 위치 (표 ↔ 픽스 흐름 사이) 에 들어갔는지 라인 번호 비교. 단순 grep -c 1 검증은 위치 오류 잡지 못함
- **lint/type-check 만 (build/test 생략)**: 변경 대상이 `.md` 파일이라 ts/build 회귀 가능성 0. PostToolUse hook 이 어차피 실행하지만 명시
