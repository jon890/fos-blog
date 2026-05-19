#!/usr/bin/env bash
# self-healing-teams M4 가드 — Branch contamination guard
# Block `git commit` that includes skill/ADR learning files when current branch ≠ main.
# Reason: 학습 누적 (BLG#, ADR, build-with-teams.md 갱신) 은 반드시 main 직접 commit.
#         PR 브랜치 / fix 브랜치에 박히면 PR scope 이탈 + 머지 시점 충돌.
# Exit 2 = block.

set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')
[ "$TOOL_NAME" = "Bash" ] || exit 0

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')

# 빠른 필터: git commit 명령이 아니면 통과
case "$CMD" in
  *"git commit"*|*"git -C "*"commit"*) ;;
  *) exit 0 ;;
esac

# 보호 대상 학습 파일 목록 (재발 시 fos-blog 외 레포에서도 prefix 만 바꾸면 재사용 가능)
PROTECTED_GLOB='\.claude/skills/_shared/common-pitfalls\.md|\.claude/skills/build-with-teams/SKILL\.md|\.claude/skills/self-healing-teams/SKILL\.md|docs/adr\.md'

# git -C 가 명령에 있으면 그 경로의 git status 사용. 없으면 cwd 의 git.
if [[ "$CMD" =~ git[[:space:]]+-C[[:space:]]+([^[:space:]]+) ]]; then
  GIT_DIR_FLAG="-C ${BASH_REMATCH[1]}"
else
  GIT_DIR_FLAG=""
fi

# 현재 staged 파일 목록 (이미 add 된 것). git commit -a / -am 케이스도 working tree 변경분 포함하도록 추가 검사.
STAGED=$(eval git $GIT_DIR_FLAG diff --cached --name-only 2>/dev/null || true)
# -a 또는 -am 옵션이면 unstaged tracked 도 함께 commit 됨
if [[ "$CMD" =~ git[[:space:]]+([^[:space:]]+[[:space:]]+)?commit[[:space:]]+(.*-a) ]]; then
  UNSTAGED=$(eval git $GIT_DIR_FLAG diff --name-only 2>/dev/null || true)
  STAGED="$STAGED"$'\n'"$UNSTAGED"
fi

# 보호 파일이 commit 대상에 포함되는가?
if ! printf '%s\n' "$STAGED" | grep -qE "$PROTECTED_GLOB"; then
  exit 0
fi

# 현재 브랜치 확인
BRANCH=$(eval git $GIT_DIR_FLAG branch --show-current 2>/dev/null || true)
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  exit 0
fi

cat >&2 <<EOF
🛑 self-healing-teams M4 guard: 학습 누적 파일을 main 외 브랜치 ($BRANCH) 에 commit 시도 차단.

대상 파일 (commit 에 포함됨):
$(printf '%s\n' "$STAGED" | grep -E "$PROTECTED_GLOB" | sed 's/^/  - /')

올바른 절차:
  git switch main && git pull --ff-only origin main
  # 그 다음에 학습 누적 commit + push origin main

이유: BLG# / ADR / SKILL.md 학습은 PR scope 외. 다른 브랜치에 박히면 머지 충돌 + PR 본문 오염.
참조: self-healing-teams/SKILL.md "F5", build-with-teams.md L417.
EOF
exit 2
