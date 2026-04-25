---
name: build-with-teams
description: Claude Agent Teams 기반 구현 자동화. 계획(team-lead) → 평가(critic) → 실행(executor) → 검증(docs-verifier) 파이프라인. 에이전트 팀이 가시적으로 협업하며 task phase 를 순차 실행.
---

# build-with-teams

task phase를 Claude Agent Teams 파이프라인으로 실행하는 시스템. 4-5명의 에이전트가 가시적으로 협업.

## 사전 검증 (실행 전 필수)

plan 인자를 받으면 **가장 먼저** `tasks/{plan}/index.json`의 `status`를 확인:
- `"completed"` → **추가 검증**: 해당 plan 의 실제 머지 커밋이 `git log` 에 존재하는지 확인 (e.g. `git log --oneline | grep -i {plan}`). 부재면 **마킹 사고** — 사용자에게 알리고 status 를 pending 으로 되돌릴지 결정
- `"pending"` 또는 `"in_progress"` → 정상 진행

이 검증을 빠뜨리면 완료된 plan 을 재실행하거나, **마킹만 된 미실행 plan 의 dependency 가 깨진 채 다음 plan 을 실행하는 사고**가 발생한다 (실사례: plan006 이 status="completed" 였지만 머지 안 된 상태에서 plan007 진행 시도, 사전 게이트 PHASE_BLOCKED).

## 핵심 원칙

1. **docs-first**: docs 반영 + 커밋 → task 생성 → 실행. 순서 위반 금지
2. **가시적 협업**: 백그라운드 스크립트 대신 에이전트 팀이 각 단계를 명시적으로 수행
3. **평가 게이트**: critic 승인 없이 실행 불가. REVISE면 계획 수정 후 재평가
4. **docs 정합성**: 실행 완료 후 docs-verifier가 코드↔문서 일치 검증
5. **재시도 한도**: 무한 루프 방지 (아래 "재시도 한도" 섹션 참조)

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

**팀원 프롬프트/메시지는 worktree 절대경로로 전달한다 (필수).**

sub-agent는 main 워킹 디렉터리에서 실행될 수 있다. 상대경로나 `tasks/{plan}/...` 형태로 지시하면 worktree 브랜치에 커밋된 최신 파일이 아니라 main의 구버전 또는 미존재 파일을 읽어 오판 사고가 발생한다.

- 파일 참조는 반드시 `/Users/.../.claude/worktrees/{plan이름}/tasks/{plan}/phase-XX.md` 형식의 절대경로
- 팀원이 구버전을 본다고 의심되면 `grep`한 실제 파일 내용을 메시지에 붙여 넣고 절대경로 재확인 요청

## 모델 라우팅 (task 규모 기반)

task의 `index.json` + phase 파일을 읽고 규모를 판정하여 팀원 모델을 동적으로 조정.

### 규모 판정 기준

| 규모 | 조건 |
|---|---|
| **소** | `total_phases: 1`, 버그 수정/UI 미세 조정/단순 설정 변경 |
| **중** | `total_phases: 2~3`, 기존 기능 확장/리팩토링/스키마 단순 추가 |
| **대** | `total_phases: 4+` 또는 아키텍처/신규 도메인/DB 스키마 대규모 변경 |

### 규모별 모델 매트릭스

| 규모 | team-lead | critic | executor | code-reviewer | docs-verifier |
|---|:---:|:---:|:---:|:---:|:---:|
| **소** | sonnet | sonnet | sonnet | sonnet | sonnet |
| **중** | sonnet | opus | sonnet | sonnet | sonnet |
| **대** | opus | opus | sonnet | sonnet | opus |

executor/code-reviewer는 모든 규모에서 sonnet 고정. 사용자가 명시적으로 모델을 지정하면 라우팅보다 우선.

## 재시도 한도 (필수)

무한 루프 방지를 위해 각 게이트에 한도 적용. 한도 초과 시 자동으로 `PHASE_BLOCKED` 처리하여 사용자(team-lead)에게 결정 위임.

| 게이트 | 한도 | 초과 시 동작 |
|---|---|---|
| **critic REVISE** | 3회 | `PHASE_BLOCKED: critic REVISE 한도 초과 — team-lead 결정 필요` |
| **code-reviewer FIX_NEEDED** | 2회 | `PHASE_BLOCKED: code-reviewer FIX 한도 초과 — 수동 검토 필요` |
| **docs-verifier UPDATE/VIOLATION** | 2회 | `PHASE_BLOCKED: docs-verifier 한도 초과 — docs/코드 정합성 수동 점검` |

team-lead는 한도 카운터를 메모리(`.omc/state/`)에 기록하여 재실행 시에도 유지.

## 실행 절차

### 1. 팀 생성

```
TeamCreate → team name: plan{N}
```

critic + docs-verifier를 `run_in_background: true`로 스폰. 대기 상태로 준비.

### 2. 문서 파악 + 논의

team-lead가 `docs/` 하위 문서를 읽고 사용자와 논의.

### 3. docs 최신화 + 커밋

논의 결과를 task 생성 전에 docs에 반영. docs 변경사항 단독 커밋.

### 4. task 파일 생성

`tasks/{task-name}/` 디렉터리에 `index.json` + `phase-{N}.md` 생성.
phase 프롬프트 규칙:

- 원자적 단일 책임, 작업 항목 5개 이하
- 자기완결적 (이전 대화 없이 독립 실행 가능)
- 성공 기준에 모든 작업 검증 포함 (grep/test/diff/build — "눈으로 확인" 금지)
- 모든 Bash 블록 앞에 `# cwd: ...` 주석

task 파일 생성 후 커밋.

### 5. critic 평가 (게이트)

team-lead → critic에게 계획 전송 (SendMessage).

critic 평가 관점:

1. Phase 순서/의존성이 올바른가?
2. 누락된 작업이 있는가?
3. 각 phase의 리스크는?
4. Phase 크기가 5개 이하인가?
5. 성공 기준이 충분한가?
6. **실제 코드와 일치하는가?** (파일 존재, 함수명, 줄 수 검증)
7. **`common-critic-patterns.md`의 모든 패턴이 사전 소진되었는가?**

판정:
- **APPROVE** → 6단계로
- **REVISE** → 문제점 수정 후 재평가 (5단계 반복, 한도 3회)

### 6. executor 실행

critic APPROVE 후 executor를 `run_in_background: true`, `mode: "bypassPermissions"`로 스폰.
critic 승인 + docs-verifier 검증의 이중 안전망이 있으므로 executor는 권한 확인 없이 실행.

executor에게 전달할 정보:
- task 파일 경로 (worktree 절대경로)
- critic의 minor notes (있으면)
- 프로젝트 환경 가정 (레포별 변형 참조)

executor 규칙:
- phase-{N}.md를 순서대로 읽고 실행
- 각 phase 완료 후 성공 기준 검증
- **커밋은 하지 않음** — team-lead가 검증 후 커밋
- 완료/실패 시 team-lead에게 결과 보고

### 7. 코드 품질 검사 (code-reviewer)

executor 완료 후 team-lead가 **code-reviewer 팀원에게 SendMessage로 검사 요청**. team-lead가 직접 수행하지 않는다 (건너뛰기 방지).

**code-reviewer 스폰 시점**: executor와 동시에 `run_in_background: true`로 스폰하되, executor 완료 후 SendMessage로 검사 시작 지시.

**code-reviewer에게 전달할 검사 항목:**

1. **금지사항**: `console.log`, `as any`, native UI dialogs (alert/confirm/prompt) — grep 검증
2. **타입 분리**: 인라인 타입이 있으면 `types/`로 분리 필요 여부
3. **unsafe `as` 캐스트**: `as Record<...>`, `as { ... }` → Zod 검증 또는 타입 가드 대체
4. **불필요한 주석 (AI slop)**: 함수명을 자국어로 번역한 것에 불과한 주석
5. **매직 넘버/문자열**: 상수 추출 필요한 하드코딩 값
6. **에러 처리**: `Promise.all` vs `Promise.allSettled`, try-catch 누락

**code-reviewer가 검사할 범위**: executor가 변경한 파일만 (`git diff --name-only` 기준).

판정 (SendMessage로 team-lead에게 회신):
- **PASS** → 8단계로
- **FIX_NEEDED** → team-lead가 executor에게 수정 목록 전달 → executor 수정 → code-reviewer 재검사 (한도 2회)

### 8. docs-verifier 검증 (문서 부패 포함)

executor 완료 후 team-lead → docs-verifier에게 검증 요청.

검증 관점:
1. ADR 결정사항 위반 여부
2. 레이어 규칙 준수
3. 코딩 규칙 (strict, any 금지, 절대경로, 1타입1파일)
4. docs 업데이트 필요 여부
5. 의사결정 의도 보존 여부
6. **문서 부패 검증 (필수)**: 코드에서 제거/변경된 기능이 docs에 아직 남아 있는지

판정:
- **PASS** → 9단계로
- **UPDATE_NEEDED** → team-lead가 docs 업데이트 후 재검증 (한도 2회)
- **VIOLATION** → team-lead가 코드 수정 지시 (executor 재투입, 한도 2회)

### 9. 완료 + PR 생성

1. team-lead가 변경사항 검토
2. 통합 검증 명령 (`pnpm lint && pnpm type-check && pnpm test && pnpm build`) 최종 확인
3. git commit + push
4. **PR 생성** — `gh pr create` (main 대상, 변경사항 요약)
5. **index.json 완료 처리 + 커밋** — **PR 머지 후 main 에서 마킹** (PR 브랜치와 main 양쪽이 같은 줄을 다르게 변경하면 머지 충돌 발생):
   - PR 머지 → `git checkout main && git pull` → `tasks/{task-name}/index.json` status 를 `"completed"` (각 phase 도) 로 변경 → 커밋 + push
   - **PR 머지 전에 main 에 직접 push 금지** (실사례: plan007 PR 머지 전 main 직접 push 로 index.json conflict 발생)
   - 또는 PR 브랜치 안에 completed 마킹 커밋을 포함시켜 PR 머지로 자동 반영
6. 팀 shutdown (SendMessage `shutdown_request`)

## worktree 기반 격리 실행 (필수)

작업 간 충돌을 방지하기 위해 반드시 **git worktree** 사용. worktree는 프로젝트 내부 `.claude/worktrees/` 하위에 생성 (프로젝트 부모 디렉터리 오염 방지).

**전제**: `.gitignore`에 `.claude/worktrees/`가 등록되어 있어야 한다.

**필수 선행 체크 — 로컬 main이 origin에 푸시되었는가?**

worktree는 `origin/main`에서 분기되므로 **로컬 main에만 있고 푸시 안 된 커밋은 worktree에 반영되지 않는다**. critic이 "task 파일 없음"으로 오판하거나 executor가 구버전 환경에서 실행하는 사고 방지.

```bash
# cwd: <repo root>
git fetch origin
git log --oneline origin/main..main   # 결과가 있으면 로컬 main이 앞서 있음 → 푸시 필요
```

결과가 비어 있지 않으면 `git push origin main` 먼저 수행.

```bash
# cwd: <repo root>
git fetch origin
mkdir -p .claude/worktrees
git worktree add .claude/worktrees/{plan이름} -b feat/{plan이름} origin/main
cd .claude/worktrees/{plan이름}
pnpm install           # 의존성 설치
pnpm db:generate       # Drizzle schema 변경이 있으면 타입 재생성 (선택)
```

**worktree 정리**: 메인 워킹 디렉토리로 돌아가서 `git worktree remove .claude/worktrees/{plan이름}`

이렇게 하면 여러 plan을 **동시 병렬 실행**해도 서로 간섭하지 않는다.

## 프로젝트 환경 가정 (레포별 변형)

이 섹션은 레포별 `skills-variants/{repo}/build-with-teams-env.md`에서 채운다. 포함 항목:

- 패키지 매니저 + 통합 검증 명령
- 빌드/테스트/린트/포맷 명령
- 마이그레이션 도구 + 비대화형 환경 함정
- worktree 직후 필수 setup (의존성 설치, 코드 생성 등)
- 코드 규칙 (`CLAUDE.md` 권위 명시)

executor·code-reviewer에게 프롬프트 전달 시 이 섹션을 참조 또는 요약 인용.

## 실패 복구

executor가 phase 실패 보고 시:
1. team-lead가 실패 원인 분석
2. phase 수정 필요 시 → critic 재평가 (5단계부터)
3. 단순 에러 수정 시 → executor에게 재실행 지시

## 실행 흐름 요약

```
[worktree 생성 (origin/main 기반)]
    → [docs 최신화 + 커밋]
    → [task 파일 생성 + 커밋]
    → [critic 평가] ←─ REVISE면 계획 수정 후 재평가 (한도 3회)
    → [executor 실행] ←─ 실패 시 원인 분석 후 재실행
    → [코드 품질 검사] ←─ FIX_NEEDED면 executor 재투입 (한도 2회)
    → [docs-verifier 검증 (문서 부패 포함)] ←─ VIOLATION/UPDATE_NEEDED면 재투입 (한도 2회)
    → [team-lead 최종 커밋 + push]
    → [PR 생성]
    → [index.json completed + 커밋/push] ← 누락 시 재실행 사고
    → [team-lead 노하우 누적 보고] ← 사용자에게 1-3줄
    → [worktree 정리 + 팀 shutdown]
```

## 노하우 누적 (세션마다 보강)

매 plan 실행 후 발견한 결함/실수/노하우 중 **재발 방지 가치 있는 것**을 1-2줄로 누적. **새 문서 신설 금지** — 에이전트가 자연스럽게 찾아갈 수 있는 기존 문서 위치만 사용.

### 누적 위치 라우팅

| 종류 | 위치 |
|---|---|
| critic 도메인 패턴 (BLG/FE/CLI) | `.claude/skills/_shared/common-critic-patterns.md` |
| build-with-teams 자체 프로세스 결함 | 이 SKILL.md (해당 섹션에 1-2줄) |
| 도메인 의사결정 | `docs/adr.md` |
| AI 에이전트 컨텍스트 | `CLAUDE.md` / `<dir>/AGENTS.md` |

### 누적 가치 판단 기준

- ✅ 누적: 패턴/규약/프로세스 결함, 같은 실수 반복 가능성 있음 (e.g. NJS15→16 mental model 잔재, plan completed 마킹 사고)
- ❌ 누적 금지: 한 번 실수, 일반 코딩 디테일 (오타, 카운트 오류, 일반 Vitest fake timer 누출 등)

### team-lead 보고 의무

PR 생성 후 worktree 정리 직전, 사용자에게 **"이번 세션 누적 노하우"** 1-3줄 보고. 누적 안 했으면 "신규 노하우 없음" 명시.

