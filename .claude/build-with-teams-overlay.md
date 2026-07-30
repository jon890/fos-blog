# build-with-teams 오버레이 — fos-blog

공용 코어(`~/.claude/skills/build-with-teams`)에 fos-blog 특화를 주입한다.
빌드와 검증 명령은 `AGENTS.md`를 따르며 여기서 반복하지 않는다.
레이어별 phase 분해 가이드는 `.claude/planning-overlay.md` 를 참조한다 (중복 작성 금지).

## 에이전트 이름 (단일 소스 — 구체 agent 우선 사용)

| 역할 | agent | 경로 |
|---|---|---|
| executor | `fos-blog-executor` | `.claude/agents/fos-blog-executor.md` |
| docs-verifier | `fos-blog-docs-verifier` | `.claude/agents/fos-blog-docs-verifier.md` |
| critic / code-reviewer | 코어 기본값 (`oh-my-claudecode:critic` / `oh-my-claudecode:code-reviewer`) | — |
| post-mortem (선택, M4) | `self-healing-postmortem` | `.claude/agents/self-healing-postmortem.md` |

Codex 환경에서는 `.codex/agents/fos-blog-executor.toml` / `.codex/agents/fos-blog-docs-verifier.toml` / `.codex/agents/self-healing-postmortem.toml` 을 우선 사용한다.
도메인 규칙은 agent 정의가 단일 소스이므로 스폰 프롬프트에 반복하지 않는다.

## 브랜치 / worktree 규칙

- worktree 루트: `.claude/worktrees/{plan}` (`.gitignore` 등록됨). 철자 오타(`.claire-worktrees` 등) pre/post-flight 정리 필수.
- 작업 브랜치: 변경 성격에 따라 `feat/`, `fix/`, `chore/`를 고르고 `{plan}-impl`을 붙인다.
- base: `main`. PR 은 `main` 대상 (Merge commit 정책은 `review-fix-overlay.md` 참조).
- worktree 생성 후 환경 setup:
  ```bash
  # cwd: .claude/worktrees/{plan}
  pnpm install
  pnpm db:generate   # Drizzle schema 변경이 있으면
  [ -f .env ] || ln -sf "$(cd .. && pwd | sed 's|/\.claude/worktrees||')/.env" .env
  ```
  `.env` 는 gitignore 대상이라 worktree 에 자동 복사되지 않는다. symlink 로 공유해야 `pnpm build` 의 env 검증(zod)이 통과한다.

## task 디렉터리 매칭 (3단 fallback)

`tasks/{plan}/` 정확 일치 외에 슬러그 suffix(`tasks/plan044-katex-math/`) 가 일반적이므로 3단으로 매칭한다:

```bash
# cwd: <repo root>
PLAN_DIR=""
[ -f "tasks/{plan}/index.json" ] && PLAN_DIR="{plan}"
[ -z "$PLAN_DIR" ] && PLAN_DIR=$(ls -d tasks/{plan}-*/ 2>/dev/null | head -1 | sed 's|tasks/||; s|/||')
[ -z "$PLAN_DIR" ] && PLAN_DIR=$(ls tasks/ 2>/dev/null | grep -i "^{plan}" | head -1)
[ -z "$PLAN_DIR" ] && echo "TASK_MISSING"
```

`ls -d tasks/{plan}-*/ | wc -l` ≥ 2 (다중 매칭, 예: `plan007` → 2개 디렉터리) 면 단독 결정 금지 — `AskUserQuestion` 으로 대상 확인.
이후 모든 `tasks/{plan}/...` 경로는 `tasks/$PLAN_DIR/...` 로 치환.

## task 정의 PR 확인

`tasks/{plan}` 브랜치의 task 정의 PR에는 구현 코드를 추가하지 않는다.
task 파일이 `main`에 반영된 뒤 `origin/main`에서 구현 브랜치를 만든다.
task 정의 PR이 아직 열려 있으면 외부 선행 조건으로 보고하고 구현 브랜치 생성을 멈춘다.

## 재발 방지 훅 (자동 차단)

| 훅 | 파일 | 차단 대상 |
|---|---|---|
| bare Agent 스폰 (`team_name` 누락) | `.claude/hooks/agent-spawn-guard.sh` (PreToolUse) | `TeamCreate` 없이 `Agent({subagent_type})` 만 호출 |
| 학습 브랜치 오염 | `.claude/hooks/branch-contamination-guard.sh` (PreToolUse) | 공용 학습 파일을 `docs/`·`chore/` 밖에서 커밋하는 경우 |

## common-pitfalls 경로

`.agents/skills/_shared/common-pitfalls.md` (`.claude/skills/_shared` 는 symlink). critic 반복 지적 패턴을 이 파일의 `P#` 섹션에 누적한다.

## M4. Post-mortem 학습 누적 (선택 — 사용자 confirm 후)

PR 생성과 팀 종료 사이에 `self-healing-postmortem`을 `fast` 실행 등급으로 호출한다.
이 에이전트는 현재 plan의 마찰과 회복 패턴을 추출한다.

입력은 다음과 같다.

- PR 브랜치의 git log
- critic 반복 횟수, 재시도, 무응답을 포함한 하위 에이전트 통신 요약
- team-lead가 마주친 분기점

산출물은 재현, 추상화, 검증이 가능한 패턴 초안 1개에서 3개다.
누적 위치는 `common-pitfalls.md`, 본 스킬, ADR, 페이지 문서 중에서 제안한다.

초안을 사용자에게 보여준 뒤 승인된 내용만 별도 `docs/` 또는 `chore/` 브랜치와 PR로 반영한다.
호출 자체는 선택 — plan 규모가 작거나 새 마찰이 없으면 skip.

## 노하우 누적 위치 라우팅 (fos-blog)

| 종류 | 누적 위치 |
|---|---|
| critic 반복 지적 패턴 | `.agents/skills/_shared/common-pitfalls.md` `P#` (Bad/Good/Why/How to apply) |
| build-with-teams 프로세스 결함 | 이 오버레이 또는 공용 코어 SKILL.md 해당 섹션 |
| 도메인 의사결정 (ADR 자명성 점검 통과) | `docs/adr/NNN-slug.md` |
| AI 에이전트 컨텍스트 (코딩 규칙·스택·레이어) | `CLAUDE.md` |
| 페이지별 상세 | `docs/pages/{page}.md` |
| 일회용 메모 | 누적 금지 — 사용자 보고로 종료 |

**관찰 사례** (이미 누적된 fos-blog 고유 사고): NJS15→16 mental model 잔재, plan completed 마킹 ↔ 머지 정합 사고, agent self-shutdown 패턴, critic v2 재평가 시 v1 재전송 사고, silent 테스트 회귀, branch 확인 누락 commit 사고.
