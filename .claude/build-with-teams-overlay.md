# build-with-teams 오버레이 — fos-blog

공용 코어(`~/.claude/skills/build-with-teams`)에 fos-blog 특화를 주입한다.
빌드/검증 명령은 `CLAUDE.md` (`pnpm lint && pnpm type-check && pnpm test -- --run && pnpm build`) 를 따르며 여기서 반복하지 않는다.
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
- 작업 브랜치: `feat/{plan}` (`origin/main` 기반 분기).
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

## task 단독 PR 이 이미 열려있는 경우 — 옵션 A 우선 (필수)

원격 `feat/{plan}` 존재 + 오픈 PR 존재가 동시에 걸리고, `gh pr view <N> --json files,additions,deletions` 결과 `tasks/{plan}/...` 만 포함(코드 변경 0)이면 **옵션 A(이어서 작업)** 로 전환한다 — 차단이 아니라 그 PR 을 결과물 통합 PR 로 그대로 쓴다.

1. 새 브랜치 만들지 않고 기존 브랜치로 worktree 체크아웃: `git worktree add .claude/worktrees/{plan} feat/{plan}` (`-b` 없음)
2. phase 실행 → commit → 같은 브랜치 push
3. PR 제목을 `chore(task)` → `feat(...)`/`fix(...)` 로 갱신 (`gh pr edit <N> --title "..."`), body 도 결과물 반영
4. 마지막 phase 의 완료 마킹도 같은 브랜치 안에서

옵션 B(별도 `-impl` 브랜치)는 task PR 이 이미 머지된 후에만 사용 — 옵션 A 가 기본, B 는 예외.

## 재발 방지 훅 (자동 차단)

| 훅 | 파일 | 차단 대상 |
|---|---|---|
| bare Agent 스폰 (`team_name` 누락) | `.claude/hooks/agent-spawn-guard.sh` (PreToolUse) | `TeamCreate` 없이 `Agent({subagent_type})` 만 호출 |
| wrong-branch 학습 commit | `.claude/hooks/branch-contamination-guard.sh` (PreToolUse) | 학습 누적 파일이 PR 브랜치에 커밋되는 경우 |

## common-pitfalls 경로

`.agents/skills/_shared/common-pitfalls.md` (`.claude/skills/_shared` 는 symlink). critic 반복 지적 패턴을 이 파일의 `P#` 섹션에 누적한다.

## M4. Post-mortem 학습 누적 (선택 — 사용자 confirm 후)

PR 생성 + 팀 종료 직전, `self-healing-postmortem` (`fast` 실행 등급) 를 spawn 해 본 plan 의 마찰/회복 패턴을 추출한다.

spawn 입력: 본 plan git log(PR 브랜치) + sub-agent 통신 요약(critic 사이클 횟수/재시도/무응답) + team-lead 가 마주친 분기점.
산출: 재현·추상화·검증 가능 패턴 1-3개 draft. 누적 위치는 agent 가 라우팅 제안 (`common-pitfalls.md` BLG# / 본 SKILL / `docs/adr/NNN-slug.md` / `docs/pages/*.md`).

**승인 게이트**: `AskUserQuestion` 으로 확인 후 main 직접 commit (본 PR 브랜치 commit 은 `branch-contamination-guard.sh` 가 차단).
호출 자체는 선택 — plan 규모가 작거나 새 마찰이 없으면 skip.

## 노하우 누적 위치 라우팅 (fos-blog)

| 종류 | 누적 위치 |
|---|---|
| critic 반복 지적 패턴 | `.agents/skills/_shared/common-pitfalls.md` `P#` (Bad/Good/Why/How to apply) |
| build-with-teams 프로세스 결함 | 이 오버레이 또는 공용 코어 SKILL.md 해당 섹션 |
| 도메인 의사결정 (ADR 자명성 게이트 통과) | `docs/adr/NNN-slug.md` |
| AI 에이전트 컨텍스트 (코딩 규칙·스택·레이어) | `CLAUDE.md` |
| 페이지별 상세 | `docs/pages/{page}.md` |
| 일회용 메모 | 누적 금지 — 사용자 보고로 종료 |

**관찰 사례** (이미 누적된 fos-blog 고유 사고): NJS15→16 mental model 잔재, plan completed 마킹 ↔ 머지 정합 사고, agent self-shutdown 패턴, critic v2 재평가 시 v1 재전송 사고, silent 테스트 회귀, branch 확인 누락 commit 사고.
