# Phase 01 — planning/SKILL.md 에 자동 검증 섹션 추가

**Model**: sonnet
**Status**: pending

---

## 목표

`.claude/skills/planning/SKILL.md` 에 "task 생성 직후 자동 검증" 신규 섹션을 추가한다. common-pitfalls § 1 의 9개 패턴 중 grep 으로 결정적 검출 가능한 5개 (1-2 / 1-4 / 1-5 / 1-8 / 1-9) 의 명령을 명시 + 위반 발견 시 AskUserQuestion 흐름 명시. 나머지 4개 (1-1 / 1-3 / 1-6 / 1-7) 는 사람 판단 필요로 표기.

**범위 외**: hook 으로 자동화 (이번 plan scope 외 — 사용자가 명시 거부, skill 본문 절차로만). webtoon-maker-v1 / 기타 레포 동기화 (별도 plan).

---

## 작업 항목 (3)

### 1. `.claude/skills/planning/SKILL.md` — "## task 생성 직후 자동 검증" 섹션 신규 추가

위치: 현재 "## 완료 후 (필수 수행 절차)" 섹션 (L166 근처) **직전** 에 새 섹션 추가. 완료 후 절차의 3번 항목 (common-pitfalls self-check) 이 본 섹션을 참조하도록.

본문 (그대로 작성):

```markdown
## task 생성 직후 자동 검증 (필수)

task 파일을 작성한 직후, 사용자에게 보고 + git commit 하기 전에 아래 grep 명령들을 실행해 `common-pitfalls.md § 1` 의 자동화 가능한 5개 패턴을 검출한다.
위반 발견 시 사용자에게 `AskUserQuestion` 으로 보고하고 "수정 / skip / 이번만 면제" 선택을 받는다. AI 가 임의로 자동 수정하지 않는다 — 의도 보존 우선.

### 자동 검출 5 패턴 (grep)

```bash
# cwd: <repo root>
PLAN=plan{N}-{slug}   # 본 task 의 디렉터리

# 1-2: "전체" 표현 (파일 범위 부정확)
grep -nE "전체\s*(수정|변경|적용|교체|리팩토링|삭제)" tasks/$PLAN/phase-*.md
# 기대: 0건. 발견 시 구체 파일 목록으로 대체 필요

# 1-4: Bash 블록의 cwd 주석 누락
awk '
  /^```bash/ { in_block=1; lines=""; start_line=NR; next }
  /^```/ && in_block {
    if (lines !~ /# cwd:/) print FILENAME ":" start_line " — Bash 블록 cwd 주석 누락"
    in_block=0; next
  }
  in_block { lines = lines "\n" $0 }
' tasks/$PLAN/phase-*.md
# 기대: 0건

# 1-5: 인간 의존 검증 (코드 블록 외 prose 라인만)
awk '
  /^```/ { in_code = !in_code; next }
  !in_code && /수동 검토|눈으로 확인|직접 확인|육안/ { print FILENAME ":" NR ": " $0 }
' tasks/$PLAN/phase-*.md
# 기대: 0건. 단 "수동 smoke" 는 dev server 동작 확인이라 OK — 정규식이 잡지 않음
# 참고: 코드 블록 안의 grep 패턴 문자열 (자기 정의) 은 의도적으로 제외

# 1-8: 마지막 phase 에 index.json completed 마킹 지시 누락
LAST_PHASE=$(ls tasks/$PLAN/phase-*.md | sort | tail -1)
grep -E "index\.json.*completed|status.*completed" "$LAST_PHASE" > /dev/null || \
  echo "$LAST_PHASE — index.json completed 마킹 지시 누락"
# 기대: 출력 없음

# 1-9: macOS BSD sed \b 미지원 (코드 블록 외 prose 라인만 — 코드 블록 안의 정의는 면제)
awk '
  /^```/ { in_code = !in_code; next }
  !in_code && /sed[[:space:]].*\\b/ { print FILENAME ":" NR ": " $0 }
' tasks/$PLAN/phase-*.md
# 기대: 0건. 발견 시 perl -i -pe 's/\bfoo\b/.../g' 로 대체 필요
```

5개 grep 모두 0 건 출력 시 통과. 1건이라도 발견되면 다음 흐름.

### 위반 발견 시 처리 (사용자 confirm 우선)

위반된 패턴과 위치를 정리해 `AskUserQuestion` 호출:

- 옵션 1: **수정** — AI 가 위반 라인을 패턴별 권장 대안으로 교체 후 다시 본 섹션 grep 재실행 (재귀, 최대 2회)
- 옵션 2: **skip** — 이번 위반은 의도된 표현. critic / build-with-teams 단계에서 다시 판단
- 옵션 3: **면제** — 본 plan 한정 면제 사유를 phase 파일 "의도 메모 (왜)" 에 명시 후 통과

사용자가 일괄 처리를 원하면 (예: "5건 다 수정해줘") 옵션 1 을 즉시 적용.

### 사람 판단 필요 4 패턴 (자동 검출 불가 — 본 섹션 grep 범위 외)

아래 패턴은 도메인 의존이라 grep 결정 검출 불가. task 작성 시 사람 (AI) 이 직접 self-check.

- **1-1 수치 추측**: "약 30개" / "100줄" 같은 수치가 실측 명령 결과인지 확인. `git diff --stat | wc -l` 등 실측 명령을 plan 에 인용
- **1-3 이전 plan / main 커밋 상호작용**: `git log origin/main --oneline -20 -- <scope-dir>/` 결과 중 plan 범위와 겹치는 변경이 있는지, 있다면 "어느 쪽이 final" 명시
- **1-6 외부 상태 gate**: PR / 배포 / push 단계 앞에 상태 확인 명령 (`gh pr view {N} --json state`) 가 있는지
- **1-7 4면 가드**: load-bearing 불변식 도입 시 Migration / Repository / Mapper / UI 4면 모두 가드 명시되어 있는지

이 4 패턴은 task 작성 self-check 체크리스트 (본 SKILL.md "Critic 패턴 사전 해소" 섹션 + common-pitfalls.md § 1) 로 보완.
```

위 블록을 `## 완료 후 (필수 수행 절차)` 섹션 **직전** 에 그대로 삽입.

### 2. `.claude/skills/planning/SKILL.md` — "## 완료 후 (필수 수행 절차)" 3번 항목 갱신

현재:
```
3. **`common-pitfalls.md` 의 P1~P9 + 패턴 소진 체크리스트 사전 해소** — task 제출 전 self-check
```

변경:
```
3. **자동 검증 실행** — 위 "task 생성 직후 자동 검증" 섹션의 5 패턴 grep 모두 0 건 확인. 위반 시 AskUserQuestion 흐름. 4 패턴 (사람 판단) 은 별도 self-check
```

### 3. `.claude/skills/_shared/common-pitfalls.md` — "## § 1 소진 체크리스트" 보강

L126 근처 체크리스트에 자동 검출 가능 표시 추가. 현재:
```markdown
plan 제출 전 9개 패턴 모두 self-check:

- [ ] **1-1**: 모든 수치가 실측 명령 결과
- [ ] **1-2**: 파일 목록이 `--name-only` 결과와 일치
...
```

변경 (각 항목 끝에 `(자동)` 또는 `(사람)` 표기):
```markdown
plan 제출 전 9개 패턴 모두 self-check (자동 검출 5 / 사람 판단 4 — 자세한 grep 은 `planning/SKILL.md` "task 생성 직후 자동 검증" 섹션):

- [ ] **1-1**: 모든 수치가 실측 명령 결과 (사람)
- [ ] **1-2**: 파일 목록이 `--name-only` 결과와 일치 (자동)
- [ ] **1-3**: 최근 10개 커밋과 이 plan 의 관계 서술 (사람)
- [ ] **1-4**: 모든 Bash 블록에 `# cwd:` 주석 (자동)
- [ ] **1-5**: 성공 기준에 인간 의존 문구 없음 (자동)
- [ ] **1-6**: 외부 상태 변경 단계에 gate + rollback (사람)
- [ ] **1-7**: load-bearing 불변식 도입 시 4면 가드 (사람)
- [ ] **1-8**: 마지막 phase 에 index.json `completed` 마킹 지시 (자동)
- [ ] **1-9**: rename 시 `sed \b` 대신 `perl` (자동)
```

자동 5 = 1-2, 1-4, 1-5, 1-8, 1-9. 사람 4 = 1-1, 1-3, 1-6, 1-7.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `.claude/skills/planning/SKILL.md` | 신규 섹션 1개 추가 + 기존 완료 후 절차 3번 항목 갱신 |
| `.claude/skills/_shared/common-pitfalls.md` | § 1 소진 체크리스트에 (자동/사람) 표기 |

## 검증

```bash
# cwd: <repo root>
# branch: feat/plan041-planning-self-check-impl (build-with-teams 자동 생성)

# 1. 신규 섹션 마커 출현
grep -cE "^## task 생성 직후 자동 검증" .claude/skills/planning/SKILL.md
# 기대: 1

# 2. 5 패턴 grep 모두 본문에 명시
grep -cE "1-2:|1-4:|1-5:|1-8:|1-9:" .claude/skills/planning/SKILL.md
# 기대: ≥ 5

# 3. AskUserQuestion 흐름 명시
grep -cE "AskUserQuestion" .claude/skills/planning/SKILL.md
# 기대: ≥ 2 (기존 + 본 섹션 추가)

# 4. 완료 후 절차 3번 항목 갱신 확인
grep -nE "자동 검증 실행" .claude/skills/planning/SKILL.md
# 기대: 1건 출현

# 5. common-pitfalls.md 체크리스트 (자동) / (사람) 마커
grep -cE "\(자동\)" .claude/skills/_shared/common-pitfalls.md
# 기대: 5
grep -cE "\(사람\)" .claude/skills/_shared/common-pitfalls.md
# 기대: 4

# 6. pnpm lint (hook 으로 자동 실행되지만 명시)
pnpm lint
```

## 의도 메모 (왜)

- **자동화 가능 5개만**: 1-1 / 1-3 / 1-6 / 1-7 은 도메인 의존이라 grep 으로 false positive 위험. MVP 는 결정적 검출 가능한 5개만. 4 개 사람 판단 패턴은 명시적으로 분리 표기 — 자동화 가능하다는 착각 회피
- **AskUserQuestion 우선 (자동 수정 아님)**: AI 가 임의로 위반 라인 수정하면 사용자 의도 손상 위험. 위치 + 패턴 보고 → 사용자가 수정/skip/면제 결정. CLAUDE.md "LLM 코딩 사고 원칙" 의 "가정하지 말고 묻기" 와 동일 원칙
- **별도 섹션 (기존 self-check 항목에 끼우지 않음)**: 검증 절차가 길어 기존 항목 안에 끼우면 가독성 손상. 별도 섹션 + 기존 절차에서는 1줄 참조
- **common-pitfalls.md 체크리스트 동기**: 자동/사람 표기를 두 곳에 두면 일관성 깨짐. common-pitfalls 가 패턴 소스, planning/SKILL.md 가 실행 명령 소스
