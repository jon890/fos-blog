# Phase 04 — planning 열린 PR 번호 점검 + executor 전용 agent 신설

**Model**: sonnet
**Status**: pending

---

## 목표

두 보강을 한다(둘 다 작은 메타 변경, 의존 없음).

- planning 의 plan/ADR 번호 충돌 방지에 **열린 PR 점검**을 추가 — 로컬 `ls` 만으로는 머지 안 된 PR 이 점유한 번호를 놓친다.
- executor 를 fos-blog 전용 agent 로 만들어 도메인 규칙을 단일화 — 현재 docs-verifier 만 전용(`fos-blog-docs-verifier`)이고 executor 는 일반 agent 라 도메인 규칙이 task phase 마다 흩어진다.

**범위 외**: adr 분해(phase-01), pitfalls(phase-02), 특이사항(phase-03).

---

## 작업 항목 (3)

> 작업 2·3 은 둘 다 `build-with-teams/SKILL.md` 의 스폰 영역 보강(한 관심사). 작업 1 만 planning 으로 독립.

### 1. planning SKILL — 번호 충돌 방지에 열린 PR 점검 추가

`.claude/skills/planning/SKILL.md` 의 "번호 충돌 방지(필수)" 섹션에 로컬 확인 + 열린 PR 확인 명령을 추가한다.

```bash
# cwd: <repo root>
# 로컬 + 열린 PR 양쪽에서 plan/ADR 번호 점유 확인
ls tasks/ | grep -oE "plan[0-9]+" | sort -u | tail -3
gh pr list --state open --json number,headRefName,title --jq '.[] | "\(.headRefName) \(.title)"'   # 열린 PR 이 점유한 plan/ADR 번호
# 열린 PR 이 adr.md 를 변경하면 그 PR 이 점유한 ADR 번호도 확인
```

설명 1줄: "머지 안 된 열린 PR 의 브랜치가 점유한 번호는 로컬 main 에 없어 놓치기 쉽다. plan052 가 실측으로 plan051(열린 PR #176)·ADR-030 점유를 이 점검으로 회피했다." 출처 brain `planning-eight-step-design`.

> 단, phase-01 이 adr.md 를 docs/adr/ 로 분해하므로, ADR 번호 확인 명령은 분해 후 구조(`ls docs/adr/[0-9]*.md`)에 맞춰 적는다. phase-01 산출 구조를 참조해 표기한다.

### 2. fos-blog-executor 전용 agent 신설 + build-with-teams 배선

`.claude/agents/fos-blog-executor.md` 를 신설한다. 기존 `fos-blog-docs-verifier.md` 의 구조를 참고하되, 골격은 brain `custom-domain-agent` 패턴을 따른다.

- **Role** — fos-blog task phase 구현 executor.
- **Domain_Rules** — CLAUDE.md 의 핵심 코딩 규칙을 모은다(레이어 app→services→infra, logger 사용/console 금지 예외, posts.isActive 필터, path 기준 업서트, Drizzle 스키마 변경 규칙 등). 단 CLAUDE.md 전문 복붙이 아니라 executor 가 자주 어기는 항목 위주로 압축 + CLAUDE.md 링크.
- **Self_Check** — 완료 직전 grep(예: `console.log` 잔재, 범위 외 파일 변경).
- **Verification_Protocol** — phase 검증 명령 실행 + 특이사항 4종 보고(phase-03 와 정합).
- **Self_Discipline** — git commit 금지(team-lead 책임), 꼭 필요한 변경만, worktree 절대경로.

그 다음 `build-with-teams/SKILL.md` 의 executor 스폰 부분이 `oh-my-claudecode:executor` 대신 `fos-blog-executor` 를 쓰도록 배선한다(스폰 프롬프트는 "호출 인자 + 직전 phase 학습 인계" 만 담아 가볍게 — 도메인 규칙은 agent 정의가 단일 소스).

> 주의: build-with-teams 가 executor 를 스폰하는 정확한 방식(agentType 명시 위치)을 SKILL.md 에서 grep 으로 확인 후 최소 변경. 스폰 가드(team_name·name 필수)는 유지한다.

### 3. build-with-teams SKILL — native teams 스폰 규약 명확화

`build-with-teams/SKILL.md` 의 "1. 팀 생성" 섹션과 "정식 팀원 스폰 규칙" 이 OMC `TeamCreate` 도구를 전제로 적혀 있어, 매 실행마다 "TeamCreate 없음" 을 발견하고 우회하는 비용이 반복된다.
이 harness 가 Claude Code native teams 모델임을 명문화한다.

- "1. 팀 생성" 섹션에 명시: 이 harness 는 Claude Code **native teams**.
  - `TeamCreate` 도구는 없다.
  - `Agent` 호출에 `team_name` 인자를 직접 넣으면 `agent-spawn-guard.sh` 통과 + 팀이 자동 형성된다.
  - 팀원 통신은 `SendMessage({to})`.
- "정식 팀원 스폰 규칙" 의 스폰 패턴 예시(`Agent({subagent_type, team_name, name, run_in_background, prompt})`)는 이미 native 호환이므로 유지.
  단 "TeamCreate 로 생성한 팀의 정식 멤버" 표현을 "team_name 인자로 등록된 팀원" 으로 정합.
- hook(`agent-spawn-guard.sh`)은 **변경하지 않는다** — team_name 인자만 있으면 통과하므로 이미 native 호환. 문서 표현만 정합.

출처: 본 plan052 실행 중 실측(team_name 인자로 critic 스폰 성공). 사용자 결정으로 plan052 에 편입.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `.claude/skills/planning/SKILL.md` | 수정 — 번호 충돌 방지에 열린 PR 점검 |
| `.claude/agents/fos-blog-executor.md` | 신규 — 전용 executor agent |
| `.claude/skills/build-with-teams/SKILL.md` | 수정 — executor 스폰 전용 agent 배선 + native teams 규약 명확화 |

## 검증

```bash
# cwd: <repo root>
grep -niE "gh pr list|열린 PR" .claude/skills/planning/SKILL.md | head        # 작업1 PR 점검 추가
[ -f .claude/agents/fos-blog-executor.md ] && echo "executor agent 신설 ✓"   # 작업2
grep -niE "fos-blog-executor" .claude/skills/build-with-teams/SKILL.md | head  # 작업2 배선 확인
# 작업2 — 잔존 oh-my-claudecode:executor 참조 0 (BLG22: SKILL ↔ .claude/agents 정합)
! grep -n "oh-my-claudecode:executor" .claude/skills/build-with-teams/SKILL.md && echo "고아 executor 참조 0 ✓"
# 작업3 — native teams 규약 명시
grep -niE "native teams|TeamCreate 도구는 없" .claude/skills/build-with-teams/SKILL.md | head
```

## 의도 메모 (왜)

- 열린 PR 점검: 로컬만 보고 번호를 부여하면 PR 머지 시 디렉터리·ADR 번호가 충돌한다. plan052 가 실제로 이 점검으로 회피했다(증거 기반 보강).
- executor 전용 agent: 도메인 규칙을 agent 정의에 모으면 스킬 스폰 프롬프트가 가벼워지고, 규칙을 스킬마다 반복하지 않아 drift 가 안 생긴다(brain custom-domain-agent).
