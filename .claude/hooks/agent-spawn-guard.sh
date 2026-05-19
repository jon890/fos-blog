#!/usr/bin/env bash
# build-with-teams — Protocol guard (F3 마찰 패턴 대응)
# Block Agent({subagent_type: critic|executor|code-reviewer|architect}) without team_name.
# Reason: build-with-teams 의 정식 팀원은 TeamCreate 로 등록 후 SendMessage 사이클에 참여해야 함.
# Exit 2 = block + show stderr to assistant.

set -euo pipefail

INPUT=$(cat)

# Hook input is JSON with tool_name + tool_input. We only act on Agent tool.
TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')
[ "$TOOL_NAME" = "Agent" ] || exit 0

SUBAGENT=$(printf '%s' "$INPUT" | jq -r '.tool_input.subagent_type // empty')
TEAM_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_input.team_name // empty')

# Managed sub-agent types that require team registration.
case "$SUBAGENT" in
  oh-my-claudecode:critic|oh-my-claudecode:executor|oh-my-claudecode:code-reviewer|oh-my-claudecode:architect)
    if [ -z "$TEAM_NAME" ]; then
      cat >&2 <<'EOF'
🛑 build-with-teams (F3): critic/executor/code-reviewer/architect 스폰 시 team_name 필수.

먼저 TeamCreate 로 팀 등록 후
  Agent({
    subagent_type: "oh-my-claudecode:<type>",
    team_name: "plan###",
    name: "critic" | "executor" | "code-reviewer" | "docs-verifier",
    run_in_background: true,
    prompt: "..."
  })
형식으로 호출.

이유: 일회성 Agent 호출은 SendMessage 라우팅이 안 돼 평가/검토 사이클이 망가짐
(build-with-teams.md "정식 팀원 스폰 규칙" 참조).
EOF
      exit 2
    fi
    ;;
  *)
    # 다른 sub-agent (general-purpose / Plan / Explore 등) 는 팀 등록 불필요
    exit 0
    ;;
esac

exit 0
