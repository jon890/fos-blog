# self-healing-teams

build-with-teams 의 메타 오케스트레이터. 4가지 자가 치유 메커니즘으로 마찰 패턴을 자동 감지·복구하고, 정말 모호한 경우에만 `AskUserQuestion` 으로 에스컬레이션. 매 실행 후 학습을 스킬 파일에 영구 기록.

## 사용 시점

build-with-teams 를 그대로 호출하지 말고 본 스킬을 wrap 으로 호출. 본 스킬은 build-with-teams 본문 절차를 그대로 실행하면서 아래 자가 치유 레이어를 덧입힌다.

```
/build-with-teams plan###       ← 직접 호출 (자가 치유 없음)
/self-healing-teams plan###     ← wrap 호출 (자가 치유 + post-mortem 자동)
```

## 30일 마이닝 결과 — Top 5 마찰 패턴

| # | 패턴 | 증상 | 출처 |
|---|---|---|---|
| **F1** | sub-agent self-shutdown | code-reviewer / architect 가 idle 알림 직후 자체 종료, verdict 미수신 | build-with-teams.md L195, fos-blog plan023+ |
| **F2** | SendMessage 회신 누락 (텍스트 출력만) | sub-agent 가 자기 화면에 평가 출력 + idle 알림만, team-lead inbox 미도달 | build-with-teams.md L168 |
| **F3** | one-off Agent 스폰 (team_name 없이) | TeamCreate 등록 없이 Agent({subagent_type: critic}) → SendMessage 라우팅 불가 | build-with-teams.md L138 |
| **F4** | stale critic v2 verdict (재읽기 누락) | REVISE 후 v2 commit 보내도 v1 평가를 그대로 반복 송신 | build-with-teams.md L335, plan007-2/plan013/plan251 |
| **F5** | wrong-branch commit (학습 누적이 PR 브랜치에 박힘) | `git commit common-pitfalls.md` 가 `feat/plan###` 또는 다른 fix 브랜치에 박힘 | 오늘 PR #124 review-fix, 메모리 `task-files-always-on-main` |

이 5개 마찰의 합산 비용은 한 plan 당 평균 1.5–3 사이클 추가 (재요청·재읽기·복구). 자동화로 0 에 수렴.

## 자가 치유 메커니즘 (4)

### M1. Heartbeat — idle 팀원 재프롬프트

**언제**: SendMessage 송신 후 T 초 (기본 90s) 안에 verdict SendMessage 회신이 오지 않고 idle 알림만 2회 이상 도착.

**복구**:
1. 같은 sub-agent 에 강제 재요청 SendMessage:
   ```
   회신이 라우팅되지 않은 것 같음. 다음 1줄을 확인해 주세요:
   "회신은 반드시 SendMessage tool 로 team-lead 에 송신. 자기 화면 텍스트만 출력하면 라우팅 안 됨."
   판정 + 1-2 문단 사유를 SendMessage 의 message 필드로 보내 주세요.
   ```
2. 그래도 회신 없으면 self-shutdown 의심 → 즉시 새로 spawn (F1 우회) + 동일 작업 메시지 묶음 송신.
3. 3회 누적 실패 → `AskUserQuestion` 으로 에스컬레이션 ("이 sub-agent 가 응답 안 함. (a) 다른 모델로 재시도 (b) team-lead 직접 처리 (C) plan abort?").

**구현**: skill 본문 절차로 명시 (Claude Code native heartbeat tool 부재). team-lead 가 SendMessage 직후 `last_send_at` 을 기억하고 다음 idle 알림 수신 시 시계 비교.

### M2. Protocol guard — bare Agent 스폰 차단

**언제**: `Agent` tool 호출이 `subagent_type ∈ {oh-my-claudecode:critic, executor, code-reviewer, architect}` 이면서 `team_name` 누락.

**복구**: `.claude/hooks/agent-spawn-guard.sh` PreToolUse 후크가 차단 (`exit 2`). 메시지:
```
🛑 self-healing-teams: critic/executor/code-reviewer/architect 스폰 시 team_name 필수.
   먼저 TeamCreate 로 팀 등록 후 Agent({team_name: "plan###", name: "critic", ...}) 형식으로 호출.
   build-with-teams.md "정식 팀원 스폰 규칙" 참조.
```

**구현**: 후크 스크립트 (아래 파일 섹션). settings.json 등록 필요.

### M3. Freshness validation — 재평가 시 강제 재읽기

**언제**: critic 에게 v2 평가 요청 시점부터 직전 v1 평가까지 5분 이상 경과 OR team-lead 가 worktree 에서 file edit/commit 을 1회 이상 수행한 후의 재평가.

**복구**: critic 재평가 SendMessage 본문에 다음 3가지 강제 포함 (build-with-teams.md L335 와 동일):

1. 변경 파일 절대경로 + `Read tool 로 다시 읽고 재평가해 줘`
2. 4-5 개 확인 포인트 체크리스트 (어느 라인이 어떻게 수정됐는지)
3. "직전 메시지는 첫 평가 사본일 수 있음 — 실제 파일 상태 기준으로 판정 부탁"

verdict 회신이 v1 과 동일 (텍스트 매칭 hash 또는 핵심 평가 라인 일치) → 즉시 위 3-block 으로 강제 재요청. 2회 동일 → `AskUserQuestion` 에스컬레이션.

**구현**: skill 본문 절차로 명시 + team-lead 가 v1/v2 verdict 본문을 비교 (단순 hash 또는 첫 200 자 비교).

### M4. Post-mortem agent — 학습 자동 누적

**언제**: PR 생성 + worktree 정리 직전 (build-with-teams.md "9. 완료 + PR 생성 + 즉시 팀 종료" 6단계).

**복구**: `oh-my-claudecode:writer` (haiku, 빠르고 저렴) 를 spawn:
- 입력: 본 plan 의 (a) git log (PR 브랜치) (b) sub-agent 통신 transcript 요약 (c) team-lead 가 마주친 분기점 (AskUserQuestion 답변 포함) (d) 검증 단계 실패/재시도 횟수
- 작업: 위 데이터에서 **재현 가능 + 추상화 가능 + 검증 가능** 패턴 1-3 개 추출 → 누적 위치 결정 (BLG# / SKILL.md 섹션 / ADR / 페이지 문서)
- 출력: SendMessage 로 team-lead 에 마크다운 draft 전달
- 승인 게이트: team-lead 가 사용자에게 `AskUserQuestion` 으로 확인 (옵션: 누적 / 일부만 / 스킵)

**중요한 가드 (F5 회피)**: 학습 누적 commit 은 **반드시 main 브랜치에서**. team-lead 는 commit 직전 다음 시퀀스 강제:

```bash
git switch main && git pull --ff-only origin main
# 그 다음에만 common-pitfalls.md / SKILL.md 수정 + commit
```

자동 차단: `.claude/hooks/branch-contamination-guard.sh` 가 `.claude/skills/_shared/` 또는 `.claude/skills/build-with-teams/SKILL.md` 또는 `docs/adr.md` 수정 후 git commit 을 시도할 때 현재 브랜치가 main 이 아니면 `exit 2`.

## 실행 절차 (build-with-teams 위에 덧입히는 단계)

build-with-teams.md 의 절차를 그대로 따르되, 아래 시점에 자가 치유 레이어 활성:

| build-with-teams 단계 | 자가 치유 추가 |
|---|---|
| 1. 팀 생성 | M2 guard 가 PreToolUse 단에서 자동 검증 (별도 작업 0) |
| 5. critic 평가 | M1 heartbeat (90s 무응답 시 재요청) + M3 freshness (REVISE v2 시 강제 재읽기 3-block) |
| 6. executor 실행 | M1 heartbeat (executor 도 동일) |
| 7. code-reviewer | M1 + F1 자동 재스폰 |
| 8. docs-verifier | M1 + F1 자동 재스폰 |
| 9. PR 생성 직후 | M4 post-mortem agent spawn → 학습 draft → 사용자 승인 → main 직접 commit (M4 가드 적용) |

## 에스컬레이션 (모호한 경우만)

자동 복구가 다음 한도에 도달하면 `AskUserQuestion` 으로 사용자에게 결정 위임:

| 사건 | 한도 | 옵션 |
|---|---|---|
| sub-agent 무응답 | M1 재요청 3회 | (a) 다른 모델 재시도 (b) team-lead 직접 처리 (c) plan abort |
| critic v2 동일 verdict | M3 강제 재읽기 2회 | (a) 한 번 더 (b) v1 결과 그대로 진행 (c) plan 재분할 |
| post-mortem draft 채택 | 항상 사용자 confirm | (a) 전부 누적 (b) 일부만 (c) 스킵 |

## 산출 파일 구조

```
.claude/
├── skills/
│   └── self-healing-teams/
│       └── SKILL.md                          ← 이 파일
├── hooks/
│   ├── agent-spawn-guard.sh                  ← M2 (PreToolUse, Agent matcher)
│   └── branch-contamination-guard.sh         ← M4 가드 (PreToolUse, Bash matcher)
├── agents/
│   └── self-healing-postmortem.md            ← M4 post-mortem 서브에이전트 정의
└── settings.json                              ← 후크 등록 (사용자가 머지)
```

## 첫 실행 가이드

1. 본 스킬 파일 + 후크 스크립트 + agent 정의가 작성됐는지 확인
2. `.claude/settings.json` 에 후크 등록 (아래 [Settings 머지](#settings-머지) 참조)
3. `chmod +x .claude/hooks/*.sh`
4. 다음 plan 부터 `/self-healing-teams plan###` 호출

## Settings 머지

기존 `.claude/settings.json` 에 다음 hooks 항목을 추가 (기존 PostToolUse 와 병기):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Agent",
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/agent-spawn-guard.sh" }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/branch-contamination-guard.sh" }
        ]
      }
    ]
  }
}
```

settings.json 의 `hooks.PreToolUse` 와 `hooks.PostToolUse` 는 별도 키. 기존 PostToolUse 는 그대로 유지.

## 노트

- M1/M3 는 후크 자동화 어렵 (model 행동 의존) → skill 본문 절차로 강제. team-lead 가 본 SKILL.md 를 매 사이클 reference 해야 효과.
- M2/M4 가드는 후크로 자동화 (deterministic).
- post-mortem agent 의 학습 누적이 잘못 commit 되지 않도록 M4 가드 = F5 자동 회피.
