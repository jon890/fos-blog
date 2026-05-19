# Phase 02 — dogfood 검증 + index.json completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

phase 01 결과를 검증한다. 본 plan 자체의 task 파일에 새 5 패턴 grep 을 시범 실행 (dogfooding) 해 위반 0 건임을 확인. 마지막으로 `tasks/plan041-planning-self-check/index.json` 의 status 를 모두 `completed` 로 마킹.

**범위 외**: SKILL.md 추가 변경 (phase 01 의 작업).

---

## 작업 항목 (2)

### 1. dogfood — 본 plan task 파일에 5 패턴 grep 시범 실행

phase 01 에서 추가한 5 패턴 grep 명령을 본 plan 자체에 실행. 위반 0 건이면 plan041 자체가 새 규칙을 통과 = self-consistent.

```bash
# cwd: <repo root>
PLAN=plan041-planning-self-check

# 1-2 "전체" 표현
grep -nE "전체\s*(수정|변경|적용|교체|리팩토링|삭제)" tasks/$PLAN/phase-*.md
# 기대: 0건 (출력 없음)

# 1-4 Bash 블록 cwd 주석 누락
awk '
  /^```bash/ { in_block=1; lines=""; start_line=NR; next }
  /^```/ && in_block {
    if (lines !~ /# cwd:/) print FILENAME ":" start_line " — Bash 블록 cwd 주석 누락"
    in_block=0; next
  }
  in_block { lines = lines "\n" $0 }
' tasks/$PLAN/phase-*.md
# 기대: 0건

# 1-5 "눈으로 확인" (코드 블록 외 prose 라인만)
awk '
  /^```/ { in_code = !in_code; next }
  !in_code && /수동 검토|눈으로 확인|직접 확인|육안/ { print FILENAME ":" NR ": " $0 }
' tasks/$PLAN/phase-*.md
# 기대: 0건

# 1-8 마지막 phase 의 index.json completed 마킹
LAST_PHASE=$(ls tasks/$PLAN/phase-*.md | sort | tail -1)
grep -E "index\.json.*completed|status.*completed" "$LAST_PHASE" > /dev/null && echo "마킹 OK" || echo "마킹 누락 — $LAST_PHASE"
# 기대: "마킹 OK"

# 1-9 sed \b (코드 블록 외 prose 라인만)
awk '
  /^```/ { in_code = !in_code; next }
  !in_code && /sed[[:space:]].*\\b/ { print FILENAME ":" NR ": " $0 }
' tasks/$PLAN/phase-*.md
# 기대: 0건
```

5 명령 모두 기대대로면 PASS. dogfood 위반이 발견되면 executor 가 본 task 파일을 phase 01 의 권장 대안으로 수정해야 함 (자기 모순 회피).

**메타 plan 면제 (1-5 / 1-9)**: 본 plan 의 phase-01.md 는 SKILL.md 본문을 ` ```markdown` 블록으로 인용한다. 이 블록 안에 ` ```bash` 블록이 중첩되어 awk 의 in_code toggle 이 깨지면서 SKILL.md 내부 정의 라인이 prose 로 잘못 판정될 수 있다 (예: awk 의 grep 패턴 정의 라인 / 주석 라인).

본 limitation 은 *메타 plan (규칙 정의 plan)* 한정 — 일반 plan 은 markdown 블록을 인용할 일이 거의 없어 영향 없음. dogfood 에서 1-5 / 1-9 위반이 1-2 건 발견되어도 위치가 SKILL.md 인용 블록 안이면 의도된 면제로 간주 (phase-01 의 line 54 / 65 가 known false positive — awk 정의 라인 자체).

phase-01 의 두 의도적 매치만 허용. 새 위반 (예: phase-02 자체에 "수동 검토" 명시) 은 PASS 아님.

### 2. 통합 검증 + index.json 마킹

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
# 기대: 둘 다 exit 0 (skill / common-pitfalls 변경은 lint/type-check 영향 없음 — sanity check 만)

# index.json 마킹
sed -i '' 's/"status": "pending"/"status": "completed"/g' tasks/plan041-planning-self-check/index.json
grep -c '"status": "completed"' tasks/plan041-planning-self-check/index.json
# 기대: 3 (1 root + 2 phases)
```

수동 smoke: 다음 plan 작성 시점에 `/planning` 호출 → task 생성 후 새 절차 (5 패턴 grep) 가 자연스럽게 실행되는지는 본 plan scope 외 — 다음 plan 작성에서 자연 검증.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `tasks/plan041-planning-self-check/index.json` | status 마킹 (pending → completed) |

## 검증

위 "dogfood" 5 명령 + "통합 검증" 블록을 그대로 실행. 모두 exit 0 + grep 기대값 충족 시 PASS.

## 의도 메모 (왜)

- **dogfooding**: 본 plan 이 도입하는 규칙을 본 plan 자체가 통과 못 하면 자기 모순. 검증 phase 에서 즉시 확인 — 새 규칙의 첫 사용자가 본 plan
- **lint/type-check 만 (build/test 생략)**: 변경 대상이 `.md` 파일 (skill 본문 + common-pitfalls) 이라 ts/build 회귀 가능성 0. lint 는 PostToolUse hook 으로 어차피 실행되지만 명시
