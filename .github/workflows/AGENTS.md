<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-03-20 | Updated: 2026-03-30 -->

# .github/workflows

## Purpose
GitHub Actions CI/CD pipelines — lint/test/build on every push/PR, and Docker image build-and-push to GitHub Container Registry (GHCR) on main branch pushes.

## Key Files

| File | Description |
|------|-------------|
| `ci.yml` | `CI` — runs on push/PR to main: `pnpm lint` → `pnpm type-check` → `pnpm test` → `pnpm build` (Node 22) |
| `deploy.yml` | `Build and Push to GHCR` — builds Docker image and pushes to `ghcr.io/<owner>/<repo>` with semantic version tags |
| `claude-code-review.yml` | `Claude Code Review` — PR 오픈/업데이트 시 TypeScript·컨벤션·보안·아키텍처 4개 병렬 에이전트가 코드 리뷰 후 인라인 코멘트와 요약 코멘트 게시 (`CLAUDE_CODE_OAUTH_TOKEN` secret 필요) |
| `lighthouse.yml` | Lighthouse CI — 성능/접근성/SEO 점수 측정 |

## For AI Agents

### Working In This Directory
- `ci.yml` uses `GH_PAT` secret for `GITHUB_TOKEN` build arg — required for GitHub API calls during `next build`
- `deploy.yml` tags images with: branch name, PR ref, semver `{{version}}`, `{{major}}.{{minor}}`, commit SHA, and `latest` (on default branch)
- Both workflows use `pnpm/action-setup@v4` + `actions/setup-node@v4` with pnpm cache
- To add a new workflow step, ensure secrets are declared in GitHub repo settings first
- `claude-code-review.yml`은 `CLAUDE_CODE_OAUTH_TOKEN` secret이 없으면 동작하지 않음 — repo Settings → Secrets에 등록 필요

### Common Patterns
```yaml
# Add to ci.yml for new checks:
- name: Run new check
  run: pnpm new-script

# Trigger deploy manually:
# workflow_dispatch is configured — use GitHub UI or gh CLI:
gh workflow run deploy.yml
```

## Dependencies

### External
- `GH_PAT` — GitHub Personal Access Token (repo secret)
- `GITHUB_TOKEN` — auto-provided by GitHub Actions for GHCR push
- `CLAUDE_CODE_OAUTH_TOKEN` — Claude Code OAuth 토큰 (`claude-code-review.yml` 전용)

<!-- MANUAL: -->
