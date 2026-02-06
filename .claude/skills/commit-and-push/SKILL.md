# Commit & Push Agent (workflow)

This document defines the **standard workflow** for an agent that performs `git commit` and `git push` in the **fos-blog** project.
Primary goals: **safety** (no leaks, no destructive ops) and **user control** (explicit approvals).

## Project Stack

- **Framework**: Next.js 16 (App Router)
- **Package Manager**: pnpm
- **Language**: TypeScript
- **Database**: MySQL + Drizzle ORM
- **Styling**: Tailwind CSS

## Commands (signals to inspect first)

```bash
git status --porcelain
git diff
git diff --staged
git log -5 --oneline
```

Before committing, run verification commands:

```bash
pnpm lint        # ESLint check (fast)
pnpm type-check  # TypeScript type check
pnpm build       # Production build (optional, for large changes)
```

## Expected user input (if available)

- **Scope**: what should be included/excluded
- **Skip verification**: `--skip-lint`, `--skip-build`, etc.
- **Push target**: remote + branch (default: `origin main`)
- **Commit style**: Conventional Commits recommended (e.g., `feat:`, `fix:`, `docs:`, `refactor:`)

If missing, infer from repo defaults, but keep actions conservative.

## Standard workflow

### 0) Safety precheck

- Inspect changes (`git status`, `git diff`, `git diff --staged`)
- Check recent history (`git log -5 --oneline`) to match message style
- Flag risky files:
  - `.env`, `.env.local`, `.env*.local` (environment variables)
  - `*.pem`, `id_rsa`, `credentials.*`, `secrets.*` (authentication)
  - `drizzle/` (generated migration files)
  - `.next/`, `node_modules/` (build artifacts)
  - If suspicious: **stop** and ask the user what to do (do not commit/push).

### 1) Verify (lint + type-check gate)

- Run ESLint first: `pnpm lint` - fast, catches style issues
- Run TypeScript check: `pnpm type-check` - catches type errors
- (Optional) For large changes: `pnpm build` - verify production build
- If any verification fails: summarize failure + propose a fix; do not proceed to commit.

### 2) Propose a staging plan

- Prefer **small, single-purpose** commits (split by concern: feature/fix/docs/config).
- List exactly what will be staged.

### 3) Draft a commit message

- Use Conventional Commits format:
  - `feat:` new feature
  - `fix:` bug fix
  - `docs:` documentation changes
  - `refactor:` code refactoring
  - `style:` code style changes
  - `chore:` miscellaneous changes
- 1–2 sentences, focus on _why_.
- **Write commit messages in Korean** (project convention)

### 4) Ask for explicit commit approval (required)

Share:

- staged file list (planned)
- final commit message
- exact commands you will run (`git add ...`, `git commit ...`)

Do not run `git commit` until the user approves.

### 5) Commit

- Stage only the approved files
- Commit with the approved message
- Show `git status --porcelain` after commit

### 6) Ask for explicit push approval (required)

Share:

- remote + branch
- exact command (`git push` / `git push -u origin <branch>`)

Do not run `git push` until the user approves.

### 7) Push

- Push only to the approved remote/branch
- Show final `git status --porcelain`

## Boundaries (hard rules)

- Never commit or push without **explicit user approval**.
- Never force push (`--force`, `--force-with-lease`) unless explicitly requested.
- Never disable hooks (`--no-verify`) unless explicitly requested.
- Avoid interactive git commands (`git add -i`, `git rebase -i`) in non-interactive environments.
- Do not commit:
  - `.env`, `.env.local` (secrets)
  - `node_modules/`, `.next/`, `drizzle/` (generated files)
  - `*.pem`, credentials

## Approval request templates

### Commit approval

- Summary:
  - …
- Will stage:
  - …
- Commit message:
  - `feat: …` / `fix: …` / etc.
- OK to run?
  - `git add …`
  - `git commit -m "…"`

### Push approval

- Push target:
  - remote: `origin`
  - branch: `main` (or feature branch)
- OK to run?
  - `git push origin main`
