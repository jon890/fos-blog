---
name: build-with-teams
description: Claude Agent Teams 기반 구현 자동화. 계획(team-lead) → 평가(critic) → 실행(executor) → 검증(docs-verifier) 파이프라인. 에이전트 팀이 가시적으로 협업하며 task phase 를 순차 실행.
---

# build-with-teams

task phase를 Claude Agent Teams 파이프라인으로 실행하는 시스템. 4-5명의 에이전트가 가시적으로 협업.

## 사전 검증 (실행 전 필수 — 3중 체크)

plan 인자를 받으면 **가장 먼저** 아래 3가지 모두 확인. 하나라도 걸리면 사용자에게 알리고 **실행 차단** (사용자 확인 없이 강행 금지):

### 1. main의 `index.json` status

```bash
# cwd: <repo root>
test -f tasks/{plan}/index.json || echo "TASK_MISSING"
jq -r .status tasks/{plan}/index.json 2>/dev/null
```

- `TASK_MISSING` → task 파일 부재. `/planning` 으로 먼저 설계할지 사용자에게 확인 (실사례: plan012 가 phase 메모에만 언급됐을 뿐 task 디렉터리는 없는 상태에서 호출됨)
- `completed` → 추가 검증 (아래 "completed 마킹 ↔ 머지 커밋 정합" 참조)
- `pending` / `in_progress` → 다음 검증으로

### 2. 원격 `feat/{plan}` 브랜치 존재

```bash
git ls-remote --heads origin "feat/{plan}" | grep -q . && echo FOUND || echo NONE
```

`FOUND` → 차단. 이미 작업 중이거나 PR 미머지 상태일 가능성. 사용자 확인 후 (a) 그 브랜치를 fetch 해서 이어서 작업할지 (b) 새로 시작할지 결정.

### 3. 해당 plan 제목을 포함한 오픈 PR

```bash
gh pr list --state open --search "{plan}" --json number,title,headRefName
```

결과 있음 → 차단. 작업 완료 후 머지 대기 중일 가능성.

> 세 검증 모두 통과해야 신규 실행. **PR 머지 전 단계에서 main 의 `index.json` 은 여전히 `pending` 이므로 1번만 보면 재실행 사고를 놓친다. 2·3번이 커버.**

### task 단독 PR 이 이미 열려있는 경우 — 옵션 A (이어서 작업) 권장 흐름 (필수)

위 2번 (FOUND) + 3번 (OPEN PR) 이 동시에 걸리고, 해당 PR 이 task 파일만 (코드 변경 0개) 머지 대기 중이라면 **옵션 A (이어서 작업)** 로 전환한다. 이는 차단이 아니라 **그 PR 을 그대로 결과물 통합 PR 로 사용**하는 흐름이다 (plan024/025 의 사후 정리 사고를 처음부터 회피).

**판정 기준** — `gh pr view <N> --json files,additions,deletions` 결과:
- `files` 가 `tasks/{plan}/...` 만 포함 + 코드 (`src/...`) 변경 0
- `state` = OPEN
→ 옵션 A 자동 권장 (사용자 confirm)

**옵션 A 흐름**:
1. **새 브랜치 만들지 말 것** — 기존 브랜치 그대로 사용
2. worktree 체크아웃: `git worktree add .claude/worktrees/{plan} feat/{plan}` (`-b` 없음 → 기존 브랜치 사용)
3. phase 실행 → 결과물 commit → **같은 브랜치**에 push (PR 에 commits 추가됨)
4. PR 제목 `chore(task)` → `feat(...)` / `fix(...)` 로 갱신: `gh pr edit <N> --title "..."` + body 도 결과물 반영 후 갱신
5. 마지막 phase 의 `status="completed"` 마킹은 같은 브랜치 안에서

**옵션 A 회피해야 하는 상황**:
- task PR 이 이미 코드 변경을 포함 (다른 사람이 부분 구현 push 중) → 사용자 confirm 후 변경 분류
- task PR 의 base 가 main 이 아닌 경우 (드물게 stacked PR) → 별도 처리

**옵션 B (별도 `-impl` 브랜치)** 는 plan024/025 처럼 task PR 과 결과물 PR 이 분리되어 사후 정리 비용이 발생하므로, task PR 이 이미 머지된 후에만 사용 (즉 옵션 A 가 불가한 상황). 사고 패턴이라 디폴트 금지.

### `completed` 마킹 ↔ 머지 커밋 정합 검증 (역방향)

status 가 `completed` 인데 실제 머지 커밋이 origin/main 에 없으면 마킹 사고. 차단 전 한 번 더 확인:

```bash
git fetch origin
git log origin/main --oneline --grep "{plan}" | head -3   # 비어있으면 마킹 사고 의심
```

부재면 사용자에게 알리고 status 를 pending 으로 되돌릴지 결정 (실사례: plan006 이 status="completed" 였지만 머지 안 된 상태에서 plan007 진행 시도, 사전 게이트 PHASE_BLOCKED).

## 핵심 원칙

1. **docs-first**: docs 반영 + 커밋 → task 생성 → 실행. 순서 위반 금지
2. **가시적 협업**: 백그라운드 스크립트 대신 에이전트 팀이 각 단계를 명시적으로 수행
3. **평가 게이트**: critic 승인 없이 실행 불가. REVISE면 계획 수정 후 재평가
4. **docs 정합성**: 실행 완료 후 docs-verifier가 코드↔문서 일치 검증
5. **재시도 한도**: 무한 루프 방지 (아래 "재시도 한도" 섹션 참조)
6. **단독 결정 금지 (필수)**: 분기점에서 자의적으로 결정하지 말고 `AskUserQuestion` 으로 사용자에게 옵션 제시. 아래 "실행 모드 선택 게이트" 참조

## 실행 모드 선택 게이트 (사전 검증 통과 직후 — 필수)

team-lead 가 plan 의 `index.json` + phase 파일을 읽고 규모를 판정한 **직후, 첫 작업 (worktree 생성 등) 전에 반드시 `AskUserQuestion` 으로 다음을 묻는다**. 자의적 판단 금지.

**질문 1 — 팀원 spawn 모드**:

| 옵션 | 설명 | 권장 상황 |
|---|---|---|
| **A. 정식 5-agent 흐름** | TeamCreate + critic + executor + code-reviewer + docs-verifier 모두 spawn | 대 규모 (4+ phases / 아키텍처 / DB 스키마 대규모 / 신규 도메인) |
| **B. 사후 검수만** | team-lead 직접 처리 → 완료 후 code-reviewer + docs-verifier 만 spawn | 중 규모 (2-3 phases / 기존 기능 확장) |
| **C. team-lead 직접 처리** | spawn 없음. 모든 단계 team-lead 가 수행 | 소 규모 (1 phase / 버그 / UI 미세 조정 / 사후 정리) + 사용자 명시 효율 우선 |

**기본 권장은 task 규모 기반**:
- 소 → C
- 중 → B (또는 사용자 결정으로 A)
- 대 → A

team-lead 가 "이전 세션이 그랬으니까 / 익숙한 패턴이라서" 같은 자의적 판단 금지. **매 호출마다 새로 질문**한다 (사용자가 "앞으로도 X 로" 라고 명시했으면 그 결정을 따르되, 그 결정도 메모리/세션 시작 시 한번 더 confirm 가능).

**왜 이 게이트가 필요한가** — plan026 (PR #120) 에서 자의적으로 모드 C 선택 → critic / code-reviewer / docs-verifier 게이트 모두 skip → 사후 검수로 보강하는 비용 발생. 시작 시점 1번 질문이 사후 보강 비용보다 훨씬 저렴.

## 분기점 단독 결정 금지 (필수 — 일반 가드)

위 모드 게이트 외에도 작업 도중 **2개 이상 옵션 사이에서 결정해야 하는 상황** 이 발생하면 자의적으로 진행하지 말고 즉시 `AskUserQuestion` 으로 사용자에게 옵션 + trade-off 제시:

- spec 충실도 (정확히 따를지 vs 보수적으로 일부 보류) — plan025 사례
- scope 변경 (executor 가 task 외 변경 발견) — `executor scope 확장 보고` 섹션 참조
- CI 실패 분류 (plan 내 / plan 외) — `9. CI 실패 시 분기 절차` 참조
- critic REVISE 한도 초과 후 다음 행동 (재분할 / skip / 사용자 결정)
- docs-verifier UPDATE_NEEDED 의 처리 시점 (PR 안 / 별도 PR / 머지 후)
- 옵션 A vs B (task 단독 PR 처리) — 위 "옵션 A 권장 흐름" 참조

**판정 기준**: 결정의 결과가 (a) 추후 회수 비용이 크거나 (b) 사용자 의도/스타일에 따라 갈리거나 (c) plan scope 를 벗어나면 즉시 질문. 단순 yes/no 도 평문 대신 `AskUserQuestion` 으로 (옵션이 사전에 명확하면).

**예외** — 질문 없이 진행해도 되는 분기:
- 이번 세션 안에서 사용자가 이미 명시적으로 결정한 동일 분기의 재발 (예: "다 반영" 답한 후 같은 PR 의 같은 카테고리 항목)
- skill 본문에 이미 명시된 가드 (옵션 A/B 우선순위, executor cwd 격리 등)
- 자명한 사실 확인 (파일 존재 / git status 등)

## 팀 구성

| 역할 | 에이전트 타입 | 기본 모델 | 책임 |
|---|---|---|---|
| **team-lead** | main session | opus | 계획 수립, task 생성, 팀 조율, 최종 커밋 |
| **critic** | `oh-my-claudecode:critic` | opus | 계획 평가 (APPROVE/REVISE), 실제 코드 대조 |
| **executor** | `oh-my-claudecode:executor` | sonnet | phase 순차 실행, 코드 수정 (커밋 제외), `bypassPermissions` |
| **code-reviewer** | `oh-my-claudecode:code-reviewer` | sonnet | 코드 품질 검사 (PASS/FIX_NEEDED), AI slop/금지사항 탐지 |
| **docs-verifier** | `oh-my-claudecode:architect` | opus | 코드↔docs 정합성 검증 (PASS/UPDATE_NEEDED/VIOLATION) |

### 정식 팀원 스폰 규칙 (필수)

critic / executor / code-reviewer / docs-verifier는 반드시 **TeamCreate로 생성한 팀의 정식 멤버**로 스폰. 일회성 `Agent` 호출(team_name 없이) 금지.

**왜?**
- 일회성 Agent 호출은 팀 컨텍스트 밖에서 동작 — `SendMessage`로 반복 협업 불가
- 정식 팀원은 idle 상태로 대기하며 REVISE 재평가, executor 재실행, docs-verifier 재검증 등 반복 사이클이 자연스러움

**스폰 패턴:**
```
Agent({
  subagent_type: "oh-my-claudecode:critic",
  team_name: "plan{N}",
  name: "critic",
  model: "opus",
  run_in_background: true,
  prompt: "..."
})
```

- `team_name` + `name`을 반드시 지정 (`name`은 `critic`/`executor`/`code-reviewer`/`docs-verifier`로 통일)
- `run_in_background: true`로 idle 대기 가능
- 이후 통신은 **모두 `SendMessage({to: "critic", message: "..."})`로만** 진행

### 팀원 프롬프트/메시지는 worktree 절대경로 (필수)

sub-agent는 main 워킹 디렉터리에서 실행될 수 있다. 상대경로나 `tasks/{plan}/...` 형태로 지시하면 worktree 브랜치에 커밋된 최신 파일이 아니라 main의 구버전 또는 미존재 파일을 읽어 오판 사고가 발생한다.

- 파일 참조는 반드시 `/Users/.../.claude/worktrees/{plan이름}/tasks/{plan}/phase-XX.md` 형식의 절대경로
- 팀원이 구버전을 본다고 의심되면 `grep`한 실제 파일 내용을 메시지에 붙여 넣고 절대경로 재확인 요청

### 팀원 SendMessage 회신 강제 (필수 — 텍스트 출력 누락 사고 방지)

스폰된 sub-agent 가 평가/검사 결론을 자기 화면에 텍스트로만 출력하고 종료하는 사고가 관측됨. 결과적으로 main session 까지 라우팅 안 됨, idle 알림만 도착 → team-lead 가 평가 결과 미수신 상태에서 다음 단계 진행 불가.

**스폰 프롬프트 + 작업 지시 메시지 양쪽**에 다음 문구를 **반드시 포함**:

```
회신은 반드시 SendMessage tool 호출로 team-lead 에게 전송할 것.
자기 화면에 텍스트만 출력하고 종료하면 main session 까지 라우팅 안 됨.
판정/결론 + 핵심 사유 1-2 문단을 SendMessage 의 message 필드로 보낼 것.
```

team-lead 는 sub-agent 의 idle 알림만 **2회 이상 연속 수신**하고 평가 결과 메시지가 없으면 통신 누락 의심 — 즉시 SendMessage 로 재요청 + "SendMessage 로 회신 부탁" 명시.

### 팀원 자발적 실행 방지 (필수)

스폰 프롬프트에 idle 대기 지시를 적어도 정식 팀원이 team-lead 의 SendMessage 지시 전에 자발적으로 실행/검증을 시작하는 사고가 관측됨. critic 평가 게이트와 시점 정합성이 망가짐.

스폰 프롬프트에 다음 문구를 **반드시 포함**:

```
대기 상태. team-lead 의 SendMessage 지시 전에 절대 자발적으로 작업/검증을 시작하지 말 것.
team-lead 가 명시적으로 "시작" 지시할 때까지 idle 유지. 자발적 실행 = 시점 오해로 잘못된 판정/사고 위험.
```

team-lead 는 critic 평가가 끝나기 전에 워크트리 상태(`git log`, `git status`)를 점검해 팀원의 자발적 실행 여부를 조기 감지.

### 팀원 self-shutdown 패턴 대응 (fos-blog 관측)

`oh-my-claudecode:code-reviewer` / `oh-my-claudecode:architect` (docs-verifier 용도) 는 `run_in_background: true` + idle prompt 로 스폰해도 **idle 알림 직후 자체 shutdown 하는 경향**이 관측됨. critic 은 응답 후 idle 유지에 성공.

**우회**: 검사 대상 결과물이 준비된 시점에 즉시 새로 spawn (idle 대기 의존 금지). team-lead 는 code-reviewer / docs-verifier 가 죽었다는 시스템 알림을 받으면 침묵 말고 **새로 스폰 + 즉시 검사 지시 메시지** 묶음으로 처리.

### executor cwd 격리 (필수 — main repo 오염 방지)

executor 프롬프트에 worktree 절대경로를 명시해도 sub-agent 가 main 워킹 디렉터리(프로젝트 루트)에서 실행되어 `cd /main-repo` 패턴으로 main 브랜치에 변경을 직접 가하는 사고가 관측됨. main 이 origin 과 다이버전스되거나 다른 plan 의 미푸시 작업과 충돌할 위험.

executor 스폰 프롬프트에 다음 가드를 **반드시 포함**:

```
모든 파일 경로 / cd 명령 / git 명령은 worktree 절대경로 (/Users/.../.claude/worktrees/{plan}/) 기준으로만 수행.
main repo 루트 (/Users/.../fos-blog) 직접 cd / 직접 파일 편집 절대 금지.
의심되면 `pwd` 로 cwd 확인 후 진행. main 오염은 reset/cherry-pick 복구가 가능하더라도 이중 진실원 위험.
```

team-lead 는 executor 작업 도중 `git -C {main-repo} status` 로 main repo working tree clean 상태를 주기 점검. dirty 발견 시 즉시 executor 중단 + 패치 worktree 로 이전 + main reset.

### executor scope 확장 보고 의무 (필수)

executor 가 phase 작업 도중 task 범위 외 코드 수정(예: pre-existing TS 에러 픽스, 우연히 발견한 bug 수정, ADR 위반 발견 후 자체 설계 변경)을 자체 판단으로 추가하는 사고가 관측됨. critic 사후 ACCEPT 가능하더라도 게이트 우회.

executor 스폰 프롬프트에 다음 가드를 **반드시 포함**:

```
task 범위 외 코드 수정(pre-existing 에러, 발견한 bug, ADR 위반 자체 변경)은 자체 판단 금지.
필요 시 SendMessage 로 team-lead 에 보고: "task 범위 외 X 발견, Y 수정 필요. 본 phase 포함 / 별도 plan 분리 결정 부탁".
team-lead 의 명시적 승인 후에만 추가. 게이트 우회 시 critic 사후 평가 사이클이 추가되고 task 본문·성공 기준이 어긋난다.
```

team-lead 처리 흐름:
- executor 보고 시 critic 사후 평가 의뢰 (단순 이동 vs 자체 변경 중 어느 쪽이 ADR-compliant 인지)
- ACCEPT → task 범위 확장 commit 메시지 명시
- REJECT → 별도 plan 분리, 본 phase 는 task 본문대로 진행

**고빈도 패턴 — `eslint-disable` / `@ts-ignore` 자체 추가는 scope 가드 위반 (webtoon-maker-v1 plan250 관측)**: ADR/lint 규칙을 회피하려고 executor 가 인라인 disable 주석을 자체 판단으로 추가하는 사고. "throw-like 라 예외" 같은 자체 정당화 포함. 이런 disable 추가는 **ADR/lint 정책 변경에 해당** — 반드시 SendMessage 로 보고 후 사용자 결정 (정책 명문화 vs 호출 위치 변경 vs 타입 가드 추가). executor 프롬프트에 다음 추가:

```
eslint-disable / @ts-ignore / @ts-nocheck / // @ts-expect-error 자체 추가 금지.
규칙 위반 발견 시 SendMessage 로 보고 — 정책 변경은 사용자 결정 영역.
```

## 모델 라우팅 (task 규모 기반)

task 의 `index.json` + phase 파일을 읽고 규모를 판정하여 팀원 모델을 동적으로 조정.

### 규모 판정 기준

| 규모 | 조건 |
|---|---|
| **소** | `total_phases: 1`, 버그 수정/UI 미세 조정/단순 설정 변경 |
| **중** | `total_phases: 2~3`, 기존 기능 확장/리팩토링/스키마 단순 추가 |
| **대** | `total_phases: 4+` 또는 아키텍처/신규 도메인/DB 스키마 대규모 변경 |

### 규모별 모델 선택 표

| 규모 | team-lead | critic | executor | code-reviewer | docs-verifier |
|---|:---:|:---:|:---:|:---:|:---:|
| **소** | sonnet | sonnet | sonnet | sonnet | sonnet |
| **중** | sonnet | opus | sonnet | sonnet | sonnet |
| **대** | opus | opus | sonnet | sonnet | opus |

executor / code-reviewer 는 모든 규모에서 sonnet 고정. 사용자가 명시적으로 모델을 지정하면 라우팅보다 우선.

### Phase 모델 가이드 (task phase 안에서 모델 명시 시)

| 모델 | 용도 |
|---|---|
| `haiku` | 기계적 작업 (git, 빌드 검증, 파일 삭제) |
| `sonnet` | 실제 구현 대부분 (코드 작성/수정/리팩토링) |
| `opus` | 계획/설계/논의 (task 외부에서만) + 복잡 알고리즘 |

## 재시도 한도 (필수)

무한 루프 방지를 위해 각 게이트에 한도 적용. 한도 초과 시 자동으로 `PHASE_BLOCKED` 처리하여 사용자(team-lead)에게 결정 위임.

| 게이트 | 한도 | 초과 시 동작 |
|---|---|---|
| **critic REVISE** | 3회 | `PHASE_BLOCKED: critic REVISE 한도 초과 — team-lead 결정 필요` |
| **code-reviewer FIX_NEEDED** | 2회 | `PHASE_BLOCKED: code-reviewer FIX 한도 초과 — 수동 검토 필요` |
| **docs-verifier UPDATE/VIOLATION** | 2회 | `PHASE_BLOCKED: docs-verifier 한도 초과 — docs/코드 정합성 수동 점검` |

team-lead 는 한도 카운터를 메모리(`.omc/state/`)에 기록하여 재실행 시에도 유지.

## 실행 절차

### 1. 팀 생성

```
TeamCreate → team name: plan{N}
```

critic + docs-verifier 를 `run_in_background: true` 로 스폰. 대기 상태로 준비. (단, fos-blog 에서는 docs-verifier / code-reviewer 가 self-shutdown 패턴이 있으므로 위 "팀원 self-shutdown 패턴 대응" 참조 — 검사 시점에 새로 스폰하는 게 안전)

### 2. 문서 파악 + 논의

team-lead 가 `docs/` 하위 문서 + `CLAUDE.md` 를 읽고 사용자와 논의.

### 3. docs 최신화 + 커밋

논의 결과를 task 생성 전에 docs 에 반영. docs 변경사항 단독 커밋.

### 4. task 파일 생성

`tasks/{task-name}/` 디렉터리에 `index.json` + `phase-{N}.md` 생성. phase 프롬프트 규칙:

- 원자적 단일 책임, 작업 항목 5개 이하
- 자기완결적 (이전 대화 없이 독립 실행 가능)
- 성공 기준에 모든 작업 검증 포함 (grep/test/diff/build — "눈으로 확인" 금지)
- 모든 Bash 블록 앞에 `# cwd: ...` 주석
- **마지막 phase 작업 목록에 `index.json` 의 `status="completed"` + 모든 phase `status="completed"` 업데이트를 포함** (task 파일 설계 단계에서 명시) — main 별도 커밋 회피

task 파일 생성 후 커밋. **단 이 commit 을 별도 PR 로 push/머지 금지** — task 파일과 phase 결과물은 **반드시 같은 PR 에 묶는다**. 별도 PR 로 task 만 머지하면 (a) status="pending" 인 채로 main 에 task 가 들어가 추후 재실행 사고 + (b) 실제 결과물이 다른 PR 에서 머지되는 경우 task spec 과 코드 간 정합 검증이 누락된다 (실사례: fos-blog plan024 — task 가 PR #110 단독 머지, 결과물은 PR #81 에서 이미 머지된 상태로 사후 정리 필요). worktree 안에서 task 파일 commit → phase 실행/검증 → 같은 브랜치 push → 한 번에 PR 생성.

**task 재분할 시 index.json 동시 갱신 강제 (필수 — webtoon-maker-v1 plan250 관측)**: critic REVISE 후 phase 파일을 재작성/추가/제거할 때 `index.json` 의 `total_phases` + `phases` 배열 + description 본문을 **반드시 같은 commit 으로 갱신**한다. phase 파일만 추가하고 index.json 미수정한 채 commit 하면 파이프라인이 신 phase 를 인식 못해 executor 가 구 phase 만 실행 → plan 핵심 누락 사고. team-lead 는 commit 직전 sanity check:

```bash
# cwd: <worktree root>
jq -r '.total_phases as $t | .phases | length as $p | "total_phases=\($t), phases.length=\($p)"' tasks/{plan}/index.json
ls tasks/{plan}/phase-*.md | wc -l   # 위 두 값과 일치해야 함
```

### 5. critic 평가 (게이트)

team-lead → critic 에게 계획 전송 (SendMessage).

critic 평가 관점:

1. Phase 순서/의존성이 올바른가?
2. 누락된 작업이 있는가?
3. 각 phase 의 리스크는?
4. Phase 크기가 5개 이하인가?
5. 성공 기준이 충분한가?
6. **실제 코드와 일치하는가?** (파일 존재, 함수명, 줄 수 검증)
7. **`common-pitfalls.md` 의 모든 패턴이 사전 소진되었는가?**

판정:
- **APPROVE** → 6단계로
- **REVISE** → 문제점 수정 후 재평가 (5단계 반복, 한도 3회)

**critic v2 재평가 시 강제 재읽기 명시 (필수 — webtoon-maker-v1 plan251 + fos-blog plan007-2/plan013 직접 관측)**: critic 이 REVISE 후 team-lead 의 v2 변경을 받고도 v1 평가를 그대로 반복 송신하는 사고. 원인은 critic 이 이전 평가 컨텍스트만 가지고 회신했고 worktree 의 신 파일을 다시 Read 하지 않은 것. team-lead 는 **재평가 메시지에 다음 3가지를 반드시 포함**:

1. `Read tool 로 다음 파일을 다시 읽고 재평가해 줘` 명시 + 변경 파일 절대경로
2. 4-5개 확인 포인트 (어느 라인 어떻게 수정됐는지) 체크리스트
3. 최소한 한 줄 "직전 메시지는 첫 평가 사본일 수 있음 — 실제 파일 상태 기준으로 판정 부탁"

단순 "재평가 부탁" 만 보내면 critic 이 캐시된 v1 결과를 재전송 가능. critic 회신이 v1 과 동일 내용이면 즉시 강제 재읽기 메시지 송신 (이번 세션 plan007-2 에서 1회 발생, 위 패턴으로 즉시 회복).

### 6. executor 실행

critic APPROVE 후 executor 를 `run_in_background: true`, `mode: "bypassPermissions"` 로 스폰. critic 승인 + docs-verifier 검증의 이중 안전망이 있으므로 executor 는 권한 확인 없이 실행.

executor 에게 전달할 정보:
- task 파일 경로 (worktree 절대경로)
- critic 의 minor notes (있으면)
- 프로젝트 환경 가정 (레포별 변형 참조)
- **위 "executor cwd 격리" + "executor scope 확장 보고 의무" 가드 문구 그대로 포함**

executor 규칙:
- phase-{N}.md 를 순서대로 읽고 실행
- 각 phase 완료 후 성공 기준 검증
- **커밋은 하지 않음** — team-lead 가 검증 후 커밋
- 완료/실패 시 team-lead 에게 결과 보고
- 코드 주석 규칙은 프로젝트 `CLAUDE.md` 를 따른다 (자명한 내용을 한국어로 번역한 주석 금지)

### 7. 코드 품질 검사 (code-reviewer)

executor 완료 후 team-lead 가 **code-reviewer 팀원에게 SendMessage 로 검사 요청**. team-lead 가 직접 수행하지 않는다 (건너뛰기 방지).

**code-reviewer 스폰 시점**: executor 와 동시에 `run_in_background: true` 로 스폰하되, executor 완료 후 SendMessage 로 검사 시작 지시. 단 **self-shutdown 패턴**이 있으므로 executor 완료 시점에 다시 스폰 + 즉시 지시 묶음이 안전.

**code-reviewer 에게 전달할 검사 항목:**

1. **금지사항**: `console.log`, `as any`, native UI dialogs (alert/confirm/prompt) — grep 검증
2. **타입 분리**: 인라인 타입이 있으면 `types/` 로 분리 필요 여부
3. **unsafe `as` 캐스트**: `as Record<...>`, `as { ... }` → Zod 검증 또는 타입 가드 대체
4. **불필요한 주석 (AI slop)**: 함수명을 자국어로 번역한 것에 불과한 주석
5. **매직 넘버/문자열**: 상수 추출 필요한 하드코딩 값
6. **에러 처리**: `Promise.all` vs `Promise.allSettled`, try-catch 누락

**code-reviewer 가 검사할 범위**: executor 가 변경한 파일만 (`git diff --name-only origin/main...HEAD` 기준).

**비자명 설계 결정 첨부 (필수 — webtoon-maker-v1 plan251 관측)**: code-reviewer 가 plan 컨텍스트를 모르면 정상 helper 사용을 권장하다 설계 의도와 충돌 (예: 의도된 raw URL 조합인데 reviewer 가 helper 통일 권장). team-lead 는 code-reviewer 검사 시작 메시지에 **plan 의 비자명 설계 결정 (helper 우회 사유, 의도된 raw pattern, scope 외 placeholder 등) 을 1-2 줄로 요약** 첨부. 그렇지 않으면 reviewer 가 false positive 를 LOW 로 올려 team-lead 가 일일이 판정해야 함. (이번 plan013 의 `subscriberCount/seriesCount` 영구 placeholder 같은 것이 사례.)

판정 (SendMessage 로 team-lead 에게 회신):
- **PASS** → 8단계로
- **FIX_NEEDED** → team-lead 가 executor 에게 수정 목록 전달 → executor 수정 → code-reviewer 재검사 (한도 2회)

#### 자기-면제 금지 (필수 — 회신 패턴 가드)

code-reviewer / docs-verifier 가 회신에 다음과 같은 자기-면제 문구를 포함해도 **team-lead 는 무시하고 재검사 SendMessage 를 강제**한다:

- "재검사 불필요"
- "trivial 한 변경이라 검증 생략 가능"
- "단순 cosmetic 이라 위험 없음"
- "이미 검토했으므로 PASS"

이유:
- trivial 1줄 수정도 회귀 가능 (PR #134 의 cosmetic 정정도 markdown 렌더링 영향 케이스)
- 일관성 보장 — 다음 plan 부터 reviewer 가 더 큰 수정 면제 요청하는 패턴 차단
- OMC `<execution_protocols>` 의 "Never self-approve" 정렬

team-lead 행동 원칙: 면제 문구 발견 시 **곧바로 SendMessage 로 "위 면제 사유는 무시하고 실제 파일 Read 후 재판정 부탁" 회신**. 회신 양식은 critic v2 캐시 사고 대응 패턴 (SKILL.md "critic v2 재평가" 섹션) 동일.

### 8. docs-verifier 검증 (문서 부패 포함)

executor 완료 후 team-lead → docs-verifier 에게 검증 요청. self-shutdown 패턴 시 재스폰 + 즉시 지시.

검증 관점:
1. ADR 결정사항 위반 여부
2. 레이어 규칙 준수 (`app/` 가 `infra/` 직접 import 금지 등 — `CLAUDE.md` 참조)
3. 코딩 규칙 (strict, any 금지, 절대경로, 1타입1파일)
4. docs 업데이트 필요 여부
5. 의사결정 의도 보존 여부
6. **문서 부패 검증 (필수)**: 코드에서 제거/변경된 기능이 docs 에 아직 남아 있는지
   - 제거된 함수/컴포넌트가 `docs/flow.md`, `docs/code-architecture.md`, `docs/pages/*.md` 에 언급되는지
   - 변경된 UI 흐름이 docs 다이어그램과 불일치하는지
   - `grep -rn "제거된키워드" docs/` 로 dead reference 검출

판정:
- **PASS** → 9단계로
- **UPDATE_NEEDED** → team-lead 가 docs 업데이트 후 재검증 (한도 2회)
- **VIOLATION** → team-lead 가 코드 수정 지시 (executor 재투입, 한도 2회)

### 9. 완료 + PR 생성 + 즉시 팀 종료

1. team-lead 가 변경사항 검토
2. 통합 검증: `pnpm lint && pnpm type-check && pnpm test -- --run && pnpm build`
3. **CI 실패 시 분기 절차 (필수)** — 변경 파일 vs 실패 원인 파일을 매칭해 책임을 분류하고 사용자 결정을 받는다. 자의적으로 plan PR 안에 외부 잔존 깨짐 fix 를 흡수하지 말 것 (scope creep + 회고 어려움).
   - **plan 범위 내 (executor 결과물 책임)**: lint/type/build 실패가 본 plan 변경 파일에서 발생 → executor 재투입(또는 team-lead 직접 fix). 사용자 결정 불필요
   - **plan 범위 외 (main 잔존 깨짐)**: 실패 원인이 본 plan 변경 외 파일 → `git diff origin/main -- <파일>` 결과 비어있음 = main 자체 깨진 상태. 사용자에게 처리 옵션 제시 후 결정:
     - **A**: plan PR 에 fix 흡수 (빠르지만 scope creep)
     - **B**: 별도 hotfix PR 분리 → 머지 후 plan PR rebase (책임 분리, 시간 소요)
     - **C**: 그대로 PR 생성 + description 에 의존 명시 (사용자가 hotfix PR 머지 후 rebase)
   - 결정 후 진행. 결정 이력은 PR description 의 "Build" 섹션에 명시
4. **`tasks/{task-name}/index.json` status="completed" 마킹은 PR 브랜치 안에서**:
   - 이상적: 마지막 phase 작업 항목에 포함 (단계 4 의 phase 설계 단계에서 명시) → 별도 commit 불필요
   - 차선: PR 브랜치 안에서 별도 `chore(tasks): mark {plan} completed` commit
   - **main 직접 커밋/푸시 금지** — 이중 진실원 + push 충돌 위험. 재실행 사고 방지는 위 "사전 검증 3중 체크" 가 담당
5. push + `gh pr create` (main 대상). CI 실패가 plan 외부에 있으면 description 에 의존 PR 번호 + 머지 순서 명시
6. **즉시 팀 shutdown** (SendMessage `shutdown_request`) + worktree 정리 + team-lead 누적 노하우 보고
7. 사용자가 GitHub 에서 PR 머지 → completed 상태 자동 main 반영. main 후속 작업 0개

## worktree 기반 격리 실행 (필수)

작업 간 충돌을 방지하기 위해 반드시 **git worktree** 사용. worktree 는 프로젝트 내부 `.claude/worktrees/` 하위에 생성 (프로젝트 부모 디렉터리 오염 방지).

**전제**: `.gitignore` 에 `.claude/worktrees/` 가 등록되어 있어야 한다. 없으면 추가 후 커밋.

**cwd 추적 + 양쪽 git status 검증 (필수 — webtoon-maker-v1 plan250 관측)**: team-lead 가 task 파일 재작성 / commit / 검증 시, 자신의 shell cwd 가 main repo 인지 worktree 인지 매번 확인 (`pwd`). 동일한 상대경로 (`tasks/{plan}/index.json` 등) 가 cwd 에 따라 다른 파일을 가리킨다 — main repo 의 task 파일을 의도치 않게 수정/삭제하는 사고 가능. 또한 system-reminder 의 "file modified" 알림이 어느 working tree 의 파일인지 명확히 표기되지 않는 경우가 있어 **commit 전 main repo + worktree 양쪽 `git status` 동시 점검** 권장:

```bash
# main repo 와 worktree 각각의 상태를 한 번에 확인
git -C /Users/.../fos-blog status --short
git -C /Users/.../fos-blog/.claude/worktrees/{plan} status --short
```

main repo 가 dirty 인데 worktree 작업 중이라면 즉시 어느 쪽이 의도된 변경인지 분류.

**경로 철자 엄수 (필수)**: worktree 루트는 정확히 `.claude/worktrees/` 다. 자동완성/타이핑 실수로 `.claire-worktrees`, `.calude/worktrees`, `.claud/worktrees` 같은 **유사 철자 디렉터리를 절대 만들지 마라**. 한 번 잘못된 경로로 만들어지면 본 skill 의 후속 절차 (lint 명령이 worktree 외부 디렉터리까지 스캔하다 실패) 가 깨진다. 셸 자동완성이 `.cl<TAB>` 에서 `.claire-*` 를 우선 매칭할 수 있으므로 자동완성 결과를 절대 그대로 쓰지 말 것.

### 메인 워킹 트리 사전 점검 (worktree 생성 직전 — 필수)

```bash
# cwd: <repo root>
# 1) 원격 동기화
git fetch origin

# 2) 로컬 main 이 origin/main 보다 앞서 있는가? (앞섰으면 push)
AHEAD=$(git log --oneline origin/main..main 2>/dev/null)
if [ -n "$AHEAD" ]; then
  echo "⚠️ 로컬 main 이 origin/main 보다 앞서 있음 — worktree 는 origin/main 기반이라 미푸시 커밋 누락 위험"
  echo "$AHEAD"
  echo "→ 'git push origin main' 후 진행 권장"
fi

# 3) 로컬 main 이 origin/main 보다 뒤져 있는가? (뒤졌으면 fast-forward 권장 — 무해하지만 정합성)
BEHIND=$(git log --oneline main..origin/main 2>/dev/null)
if [ -n "$BEHIND" ]; then
  echo "ℹ️ origin/main 이 로컬 main 보다 앞섬 — fast-forward 권장 (worktree 는 origin/main 기반이라 영향 없음)"
fi

# 4) 현재 브랜치 + dirty 상태 안내 (가드만 — 차단 아님)
CURRENT=$(git branch --show-current)
[ "$CURRENT" != "main" ] && echo "ℹ️ 현재 브랜치 $CURRENT — worktree 는 origin/main 기반이라 무관. 메인 워킹 트리 dirty 가 신경 쓰이면 stash 권장"
git diff --quiet && git diff --cached --quiet || { echo "⚠️ 메인 워킹 트리에 미커밋 변경 있음:"; git status --short; }
```

위 출력은 **경고/안내**일 뿐 차단은 아니다. worktree 자체는 `origin/main` 기반이라 항상 원격 최신 ref 에서 분기되므로 메인 워킹 트리 상태와 독립적이다. 단 사용자가 "main 도 깔끔하게 동기화" 를 원하면 worktree 생성 전에 `git switch main && git pull --ff-only` 를 권장.

### 오타 worktree 잔재 자동 정리 (pre-flight + post-flight 모두 필수)

worktree 생성 직전과 정리 직후 두 시점에 모두 아래 명령으로 `.claude` 외 `.cla*` 디렉터리를 탐지하고 발견 즉시 `rm -rf` 로 제거. 명백한 오타 변형 (`.claire-worktrees`, `.calude-*`, `.claud-*`) 은 사용자 동의 없이 즉시 제거 후 1줄 보고. 단 `.claude-` 로 시작하는 (의도된 다른 디렉터리) 가 있다면 사용자에게 먼저 확인.

```bash
# cwd: <repo root>
STRAY=$(find . -maxdepth 1 -type d -name '.cla*' ! -name '.claude' 2>/dev/null)
if [ -n "$STRAY" ]; then
  echo "⚠️ 오타 worktree 디렉터리 잔재 발견 — 자동 제거:"
  echo "$STRAY"
  echo "$STRAY" | xargs -I{} rm -rf {}
fi
```

실사례: `.claire-worktrees/plan011-...` 가 ESLint 에러 유발 — 다음 plan 시작 시점에 자동 정리되도록 게이트화.

### worktree 생성

```bash
# cwd: <repo root>
mkdir -p .claude/worktrees
git worktree add .claude/worktrees/{plan이름} -b feat/{plan이름} origin/main
cd .claude/worktrees/{plan이름}
pnpm install                # 의존성 설치
pnpm db:generate            # Drizzle schema 변경이 있으면 타입 재생성 (선택)
```

**worktree 정리**: 메인 워킹 디렉토리로 돌아가서 `git worktree remove .claude/worktrees/{plan이름}` + 로컬 브랜치 정리 `git branch -D feat/{plan이름}` (PR 머지 후엔 안전).

이렇게 하면 여러 plan 을 **동시 병렬 실행**해도 서로 간섭하지 않는다.

## 프로젝트 환경 가정 (fos-blog 특화)

이 섹션은 executor / code-reviewer 에게 프롬프트로 전달할 때 참조 또는 요약 인용.

- **패키지 매니저**: `pnpm`. 통합 검증은 `pnpm lint && pnpm type-check && pnpm test -- --run && pnpm build`
- **DB 스키마 (Drizzle)**: 변경 시 `pnpm db:generate` 로 SQL 마이그레이션 생성 → 커밋 포함. `pnpm db:push` 프로덕션 사용 금지 (`CLAUDE.md` 의 "DB 스키마 변경 규칙" 참조)
- **scripts/*.ts 의 console.log 예외**: standalone 실행이라 logger import 불가 → console 허용 (eslint config 에서 globals 명시됨)
- **deployment**: 홈서버 (Docker + standalone Next.js). Vercel-only 기능 (Cron, Edge Functions, ISR invalidation) 제안 금지
- **코드 규칙**: `CLAUDE.md` 가 권위. 주석 규칙 / 금지사항 / 레이어 규칙은 `CLAUDE.md` 를 참조시킨다

## 실패 복구

executor 가 phase 실패 보고 시:
1. team-lead 가 실패 원인 분석
2. phase 수정 필요 시 → critic 재평가 (5단계부터)
3. 단순 에러 수정 시 → executor 에게 재실행 지시

## 실행 흐름 요약

```
[사전 검증 3중 체크 — main index.json status + 원격 feat 브랜치 + 오픈 PR]
    → [실행 모드 선택 게이트 — AskUserQuestion: A 정식 / B 사후검수 / C 직접]
    → [메인 워킹 트리 사전 점검 (앞섬/뒤짐/dirty 안내)]
    → [오타 worktree pre-flight 정리]
    → [worktree 생성 (origin/main 기반)]
    → [docs 최신화 + 커밋]
    → [task 파일 생성 + 커밋]  ← 마지막 phase 에 index.json completed 업데이트 포함
    → [critic 평가] ←─ REVISE 면 계획 수정 후 재평가 (한도 3회)
    → [executor 실행 — cwd 격리 + scope 확장 보고 가드] ←─ 실패 시 원인 분석 후 재실행
    → [code-reviewer 검사] ←─ FIX_NEEDED 면 executor 재투입 (한도 2회)
    → [docs-verifier 검증 (문서 부패 포함)] ←─ VIOLATION/UPDATE_NEEDED 면 재투입 (한도 2회)
    → [통합 검증 (CI) — 실패 시 plan 범위 내/외 분기 절차]
    → [team-lead 최종 push (PR 브랜치 안에서 index.json completed 마킹 포함)]
    → [PR 생성 (main 대상)]
    → [팀 즉시 shutdown + worktree 정리 (post-flight 오타 정리 1회 더) + 누적 노하우 보고]
    → (사용자 PR 머지 → completed 자동 main 반영, 후속 작업 0개)
```

## 노하우 누적 (세션마다 보강)

매 plan 실행 후 발견한 결함/실수/노하우 중 **재발 방지 가치 있는 것**을 1-2줄로 누적. **새 문서 신설 금지** — 에이전트가 자연스럽게 찾아갈 수 있는 기존 문서 위치만 사용.

### 누적 위치 라우팅

| 종류 | 트리거 (어떤 사고/관찰) | 누적 위치 | 형식 / 섹션 |
|---|---|---|---|
| critic 반복 지적 패턴 | critic 이 동일 결함 타입을 2회+ 지적 | `.claude/skills/_shared/common-pitfalls.md` | `### P{N}.` (Bad / Good / Why / How to apply 4-section) |
| build-with-teams 프로세스 결함 | sub-agent 협업 / 게이트 / worktree 절차 자체에서 사고 발생 | 이 SKILL.md | 해당 섹션 (예: "팀원 자발적 실행 방지", "executor cwd 격리") 끝에 1-2줄 |
| 도메인 의사결정 | "왜 X 를 선택했는가" 가 코드만 봐서는 추론 불가 + ADR 자명성 게이트 통과 | `docs/adr.md` | `## ADR-XXX` (결정 / 맥락 / 대안 기각 구조) |
| AI 에이전트 컨텍스트 | 프로젝트 전반 코딩 규칙 / 스택 / 레이어 / 금지사항 변경 | `CLAUDE.md` / `<dir>/AGENTS.md` | 기존 섹션 갱신 또는 신규 1-2줄 |
| 페이지별 상세 | 특정 page.tsx 의 흐름 / 컴포넌트 / Data 변경 | `docs/pages/{page}.md` | Components / Data / Layout 표 갱신 |
| 일회용 메모 (다음 plan 동안만 유효) | 재발 가능성 낮지만 잠시 잊지 않을 정보 | (누적 금지 — 사용자 보고로 끝) | — |

### 누적 가치 판단 기준

| 기준 | ✅ 누적 | ❌ 누적 금지 |
|---|---|---|
| **재발 가능성** | 패턴 / 규약 / 프로세스 결함, 같은 실수 반복 가능 | 한 번 실수 (단순 오타, 카운트 오류) |
| **추상화 정도** | 1-2 단어로 패턴화 가능 (e.g. "agent self-shutdown 패턴", "SVG presentation attribute var() 미해결") | 매우 구체적 1회성 (e.g. "어제 plan013 의 hero 색상 잘못 잡음") |
| **검증 가능성** | grep / test / build 등 기계 명령으로 재발 시 즉시 검출 가능 | 사람의 주관적 판단에만 의존 |
| **scope** | critic / executor / docs-verifier 의 일반 행동에 영향 | 한 plan 의 task 본문에서만 의미 |

**관찰 사례** (이미 누적된 fos-blog 고유 사고):
- NJS15 → 16 mental model 잔재 (proxy.ts 규약 위반)
- plan completed 마킹 ↔ 머지 정합 사고 (재실행 사고)
- agent self-shutdown 패턴 (code-reviewer / docs-verifier idle 후 자체 종료)
- critic v2 재평가 시 v1 재전송 사고
- silent 테스트 회귀 (rate-limit 우회 확장 시 기존 sweep test IP 흡수)
- branch 확인 누락 commit 사고 (PR 작업 브랜치에 무관 commit 박힘)

### team-lead 보고 의무

PR 생성 후 worktree 정리 직전, 사용자에게 **"이번 세션 누적 노하우"** 1-3줄 보고. 누적 안 했으면 "신규 노하우 없음" 명시.

## vs plan-and-build (참고)

|  | plan-and-build | build-with-teams |
|---|---|---|
| 실행 방식 | 백그라운드 스크립트 | Claude Agent Teams 가시적 협업 |
| 평가 단계 | 없음 | critic APPROVE 게이트 |
| docs 검증 | 없음 | docs-verifier 자동 검증 |
| 진행 상황 | 로그 파일 확인 | 에이전트 메시지로 실시간 확인 |
| 실패 복구 | `--from-phase` 재시작 | team-lead 판단 → executor 재지시 |
