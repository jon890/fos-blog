# Phase 02 — self-healing-teams 폐기 + build-with-teams 본문 흡수

**Model**: sonnet
**Status**: pending

---

## 목표

`.claude/skills/self-healing-teams/` 디렉터리 제거 + 잔존 가치 3개 항목 (Top 5 마찰 패턴 표 / heartbeat 90s 시간 규칙 / M4 post-mortem agent spawn 절차) 을 `.claude/skills/build-with-teams/SKILL.md` 본문에 흡수. hooks 2개 (`agent-spawn-guard.sh` / `branch-contamination-guard.sh`) + agent (`self-healing-postmortem.md`) 는 유지.

**범위 외**: commit-and-push 폐기 (phase 01).

---

## 작업 항목 (3)

### 1. `.claude/skills/build-with-teams/SKILL.md` 본문 흡수

#### (a) "Top 5 마찰 패턴 표" 신규 섹션 — "## 팀 구성" (L125 근처) 직후에 추가

self-healing-teams/SKILL.md L14-24 의 표를 거의 그대로 옮긴다. 단 출처 / 마이닝 메타 표현은 단순화:

```markdown
## 자주 발생하는 마찰 패턴 (재발 방지 참조)

build-with-teams 운영에서 반복 관측된 5가지 마찰. 각 절차 단계에서 대응 가드를 적용.

| # | 패턴 | 증상 | 대응 위치 |
|---|---|---|---|
| **F1** | sub-agent self-shutdown | code-reviewer / architect 가 idle 알림 직후 자체 종료, verdict 미수신 | "팀원 self-shutdown 패턴 대응" 섹션 |
| **F2** | SendMessage 회신 누락 | sub-agent 가 평가를 자기 화면에만 출력, team-lead inbox 미도달 | "팀원 SendMessage 회신 강제" 섹션 |
| **F3** | bare Agent 스폰 (team_name 누락) | TeamCreate 없이 Agent({subagent_type: critic}) → 라우팅 불가 | `.claude/hooks/agent-spawn-guard.sh` (PreToolUse 자동 차단) |
| **F4** | critic v2 stale verdict | REVISE 후 v2 commit 송신해도 v1 평가 반복 송신 | "critic v2 재평가 강제 재읽기" (5. critic 평가 섹션) |
| **F5** | wrong-branch 학습 commit | 학습 누적 파일이 PR 브랜치에 박힘 | `.claude/hooks/branch-contamination-guard.sh` (PreToolUse 자동 차단) |
```

각 패턴의 대응은 build-with-teams 본문 절차 내 또는 hook 으로 이미 분산되어 있다. 본 표는 *목록 + 라우팅* 만 제공.

#### (b) "팀원 self-shutdown 패턴 대응" 섹션 (L193) 에 heartbeat 시간 규칙 추가

현재 본문은 self-shutdown 패턴 설명 + 재스폰 방법만 있고, **언제 self-shutdown 으로 판정할지** 의 시간 규칙이 없다. 다음 한 단락 추가 (섹션 끝에):

```markdown
**판정 시간 규칙 (heartbeat)**: SendMessage 송신 후 **90s** 안에 verdict SendMessage 회신이 오지 않고 idle 알림만 2회 이상 도착하면 self-shutdown 의심. team-lead 는 즉시 (a) 같은 sub-agent 에 강제 재요청 SendMessage 1회 (b) 그래도 무응답이면 새로 spawn + 동일 작업 메시지 묶음 송신. 3회 누적 실패 → `AskUserQuestion` 으로 에스컬레이션 ("다른 모델 재시도 / team-lead 직접 처리 / plan abort").
```

#### (c) "9. 완료 + PR 생성 + 즉시 팀 종료" 섹션에 M4 post-mortem agent spawn 절차 추가

현재 build-with-teams 의 "9. 완료" 단계는 PR 생성 + 팀 종료만 명시. self-healing-teams 의 M4 (post-mortem agent 자동 호출) 를 흡수. 다음 sub-섹션을 9 단계 끝에 추가:

```markdown
### M4. Post-mortem 학습 누적 (선택 — 사용자 confirm 후)

PR 생성 + 팀 종료 직전에 `self-healing-postmortem` 커스텀 agent (`.claude/agents/self-healing-postmortem.md`, haiku) 를 spawn 해 본 plan 의 마찰/회복 패턴을 추출한다.

spawn 입력:
- 본 plan 의 git log (PR 브랜치)
- sub-agent 통신 transcript 요약 (critic 사이클 횟수 / 재시도 / 무응답 사건)
- team-lead 가 마주친 분기점 (AskUserQuestion 답변 포함)

agent 산출: 재현 가능 + 추상화 가능 + 검증 가능 패턴 1-3 개의 마크다운 draft. 누적 위치는 agent 가 라우팅 제안 (BLG# / SKILL.md / ADR / 페이지 docs 중 하나).

**승인 게이트** (필수): team-lead 가 사용자에게 `AskUserQuestion` 으로 확인 후 main 직접 commit. 본 PR 브랜치 commit 금지 — `branch-contamination-guard.sh` 가 자동 차단.

호출 자체는 선택 — plan 규모가 작거나 새 마찰이 없으면 skip. "노하우 누적" 섹션의 누적 가치 판단 기준을 따른다.
```

이 sub-섹션은 self-healing-teams 의 M4 본문을 단순화한 것 — 시간 규칙 / wrap 호출 패턴 등 사용자 보지 않는 메타는 제거.

### 2. `.claude/skills/self-healing-teams/` 디렉터리 삭제

```bash
# cwd: <repo root>
rm -rf .claude/skills/self-healing-teams
test ! -d .claude/skills/self-healing-teams && echo "삭제 OK"
```

부수 효과:
```bash
# 다른 skill / agent / docs 의 참조 잔재
grep -rnE "self-healing-teams" .claude/ docs/ CLAUDE.md 2>&1 | grep -v "^Binary" | head -20
# 기대: 0건 (참조 잔재 0)
```

agent 파일은 유지 — 호출 주체가 self-healing-teams skill → build-with-teams skill 로 전환:
```bash
test -f .claude/agents/self-healing-postmortem.md && echo "agent 유지 OK"
test -f .claude/hooks/agent-spawn-guard.sh && echo "hook1 유지 OK"
test -f .claude/hooks/branch-contamination-guard.sh && echo "hook2 유지 OK"
```

### 3. `.claude/agents/self-healing-postmortem.md` 호출 주체 라인 갱신

agent 파일 frontmatter description 에 "build-with-teams 파이프라인 1회 실행 후" 라고 이미 적혀 있어 변경 불필요. 단 본문에 self-healing-teams 참조가 있으면 교체:

```bash
grep -n "self-healing-teams" .claude/agents/self-healing-postmortem.md
# 발견된 라인 → build-with-teams 로 교체 (sed)
```

발견 0 건이면 skip.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `.claude/skills/build-with-teams/SKILL.md` | 본문 3개 항목 추가 (마찰 패턴 표 / heartbeat 시간 / M4 절차) |
| `.claude/skills/self-healing-teams/` | 디렉터리 삭제 |
| `.claude/agents/self-healing-postmortem.md` | 본문에 self-healing-teams 참조 있으면 build-with-teams 로 교체 (없으면 skip) |

## 검증

```bash
# cwd: <repo root>

# 1. 디렉터리 삭제 확인
test ! -d .claude/skills/self-healing-teams && echo "삭제 OK"

# 2. 참조 잔재 0
grep -rnE "self-healing-teams" .claude/ docs/ CLAUDE.md 2>&1 | grep -v "^Binary" | wc -l
# 기대: 0

# 3. build-with-teams SKILL.md 보강 마커
grep -cE "자주 발생하는 마찰 패턴|판정 시간 규칙 \(heartbeat\)|M4\. Post-mortem 학습 누적" .claude/skills/build-with-teams/SKILL.md
# 기대: ≥ 3 (각 sub-섹션 헤딩 1회씩)

# 4. F1-F5 표 모두 흡수
grep -cE "\*\*F[1-5]\*\*" .claude/skills/build-with-teams/SKILL.md
# 기대: 5

# 5. hooks + agent 유지
test -f .claude/hooks/agent-spawn-guard.sh && \
test -f .claude/hooks/branch-contamination-guard.sh && \
test -f .claude/agents/self-healing-postmortem.md && echo "유지 자원 OK"

# 6. lint
pnpm lint
```

## 의도 메모 (왜)

- **build-with-teams 단일 소스로 일원화**: self-healing-teams wrap 호출 구조가 사용 0 회. wrap 없이 build-with-teams 가 직접 자가 치유 절차를 보유하는 게 자연. M1/M3 는 이미 부분 흡수되어 있어 보강이 효율적
- **hooks/agent 자원 유지**: M2/M4 의 deterministic 가드 (PreToolUse hooks) + post-mortem agent 정의는 skill wrap 과 독립. skill 폐기해도 호출 주체만 build-with-teams 로 전환하면 됨
- **표 단순화**: self-healing-teams 의 "30일 마이닝" / "wrap 호출 패턴" 같은 메타는 사용자가 보지 않는 정보. 표는 *패턴 + 라우팅* 만 흡수
