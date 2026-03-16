<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-03-17 -->

# lib

## Purpose
Shared utility functions and service clients. Contains the GitHub API integration, markdown processing helpers, the GitHub→DB sync orchestration, and a legacy database query wrapper. Pure TypeScript modules with no React dependencies.

## Key Files

| File | Description |
|------|-------------|
| `github.ts` | Octokit-based GitHub REST API client — fetches repository file trees and raw markdown content |
| `markdown.ts` | Markdown processing utilities — frontmatter extraction and remark/rehype plugin transformation |
| `sync-github.ts` | Sync orchestration — pulls all markdown files from GitHub and writes/updates them in the database |
| `db-queries.ts` | **Legacy** standalone query functions (used by `app/page.tsx`); being superseded by `db/queries.ts` (the `DbQueries` class) |

## For AI Agents

### Working In This Directory
- `github.ts` requires `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` environment variables
- `sync-github.ts` uses SHA-based change detection to avoid re-processing unchanged files
- **Prefer `db/queries.ts` (DbQueries class) over `lib/db-queries.ts`** for new code — the latter is a migration artifact
- All functions here are meant to be pure/side-effect-free except `sync-github.ts` (which writes to DB by design)

### Testing Requirements
- GitHub API calls require a valid token; mock Octokit for unit tests
- Sync tests need a running MySQL instance or transaction rollback

### Common Patterns
```ts
// GitHub file fetch
import { fetchMarkdownFile } from "@/lib/github";
const content = await fetchMarkdownFile(owner, repo, path);

// Markdown frontmatter
import { parseMarkdownFrontmatter } from "@/lib/markdown";
const { title, description } = parseMarkdownFrontmatter(rawContent);

// Triggering sync (from API route)
import { syncGitHubToDatabase } from "@/lib/sync-github";
const result = await syncGitHubToDatabase();
```

## Dependencies

### Internal
- `db/` — Drizzle ORM connection and schema

### External
- `@octokit/rest` — GitHub REST API client
- `gray-matter` or similar — frontmatter parsing (check actual import in `markdown.ts`)
- `mysql2` — database driver (via `db/index.ts`)

<!-- MANUAL: -->
