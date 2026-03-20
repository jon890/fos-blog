---
name: commit-and-push
description: Standard workflow for safely committing, pushing, and creating PRs in fos-blog. ALWAYS use this skill when the user says "커밋", "푸시", "올려줘", "반영해줘", "PR 만들어줘", "PR 생성", "작업 저장", "commit", "push", "save work", or any git workflow request — even if they don't mention all three steps. Enforces pnpm lint/type-check, Conventional Commits in Korean, and guides through commit → push → PR as a single unified flow.
metadata:
  author: bifos
  version: "2.1.0"
  argument-hint: <file-or-pattern>
---

# Commit, Push & PR Agent (workflow)

This skill handles the full `git commit → git push → gh pr create` flow for fos-blog.
Primary goals: **safety** (no leaks, no destructive ops) and **efficiency** (minimize roundtrips while keeping user in control).

## Project Stack

- **Framework**: Next.js 16 (App Router)
- **Package Manager**: pnpm
- **Language**: TypeScript
- **Database**: MySQL + Drizzle ORM
- **Styling**: Tailwind CSS

## Expected user input (if available)

- **Scope**: what files to include/exclude
- **Skip verification**: `--skip-lint`, `--skip-build`, etc.
- **Fast path**: if user says "다 진행해줘" / "전부 처리해줘" / "그냥 다 해줘" → use **batch approval mode** (ask all 3 approvals in one message)
- **Commit style**: Conventional Commits in Korean (e.g., `feat:`, `fix:`, `docs:`, `refactor:`)

## Standard workflow

### 0) Safety precheck

Run in parallel:
```bash
git status --porcelain
git branch --show-current
git log -5 --oneline
```

If `pnpm-lock.yaml` is modified (e.g., after `pnpm add`), **always include it in the same commit** as the package.json change. Failing to do so breaks `--frozen-lockfile` CI.

Flag and **stop** (do not proceed) if any of these appear:
- `.env`, `.env.local`, `.env*.local` (environment secrets)
- `*.pem`, `id_rsa`, `credentials.*`, `secrets.*` (keys/credentials)
- `.next/`, `node_modules/` (build artifacts)
- `.omc/` (OMC internal state — should be gitignored)
- `drizzle/` migrations — **except** `drizzle/AGENTS.md` which is allowed

If suspicious: stop and ask the user before proceeding.

### 1) Verify (lint + type-check gate)

```bash
pnpm lint        # ESLint — fast, run first
pnpm type-check  # TypeScript — catches type errors
```

- For large changes, optionally run `pnpm build`
- If verification fails: explain the error, propose a fix, do **not** proceed to commit

### 2) Staging plan

- Group related changes into small, single-purpose commits
- List exactly which files will be staged

### 3) Draft commit message

Use Conventional Commits format, **written in Korean**:
- `feat:` 새 기능
- `fix:` 버그 수정
- `docs:` 문서 변경
- `refactor:` 코드 리팩토링
- `style:` 스타일/포맷
- `chore:` 기타

Focus on *why*, not *what*. 1–2 sentences.

### 4–8) Approval flow

**Choose based on user intent:**

#### Standard mode (default)
Ask for approval at each step separately → commit → push → PR

#### Batch approval mode
When user pre-approves everything ("응 다 진행해줘", "다 처리해줘", "전부 해줘"), present all 3 actions in ONE message and ask once:

```
다음 세 가지를 순서대로 실행할게요:

1. 커밋
   - 스테이징: <files>
   - 메시지: `feat: …`

2. 푸시
   - git push -u origin <branch>

3. PR 생성 (if applicable)
   - 제목: …
   - base: main

OK?
```

Then execute all three in sequence after one confirmation.

### PR creation (step 8)

**Skip PR if:**
- Current branch is `main` or `master`
- User explicitly said no PR

**Before creating PR, check for existing PR:**
```bash
gh pr list --head <branch> --state open
```
If one exists, show the URL instead of creating a new one.

**PR creation:**
```bash
gh pr create \
  --title "…" \
  --base main \
  --body "$(cat <<'EOF'
## Summary
- …

## Test plan
- [ ] …

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

After creation, show the PR URL.

## Boundaries (hard rules)

- Never commit, push, or create PR without explicit user approval
- Never force push (`--force`, `--force-with-lease`) unless explicitly requested
- Never disable hooks (`--no-verify`) unless explicitly requested
- Avoid interactive git commands in non-interactive environments
- Do not commit:
  - `.env`, `.env.local` and variants (secrets)
  - `node_modules/`, `.next/`, `.omc/` (generated/state files)
  - `drizzle/` migrations (except `drizzle/AGENTS.md`)
  - `*.pem`, credentials

## Approval request templates

### Commit approval

```
커밋 승인 요청:
- 스테이징: <files>
- 메시지: `feat: …`
OK?
  git add …
  git commit -m "…"
```

### Push approval

```
푸시 승인 요청:
- origin/<branch>
OK?
  git push -u origin <branch>
```

### PR approval

```
PR 생성 승인 요청:
- 제목: …
- base: main ← <branch>
- Summary: …
OK?
  gh pr create --title "…" --base main --body "…"
```
