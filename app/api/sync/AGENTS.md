<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-03-17 -->

# app/api/sync

## Purpose
POST/GET endpoint that triggers a full GitHub-to-database sync. Pulls all markdown files from the configured GitHub repository and upserts them into MySQL. Intended for manual calls or cron jobs.

## Key Files

| File | Description |
|------|-------------|
| `route.ts` | `POST /api/sync` (and `GET` for dev convenience) — validates Bearer token then calls `syncGitHubToDatabase()` |

## For AI Agents

### Working In This Directory
- Protected by `SYNC_API_KEY` env var — if set, requests must include `Authorization: Bearer <key>`
- `GET` is an alias for `POST` for development convenience; keep this in mind when testing
- Returns sync statistics: `postsAdded`, `postsUpdated`, `postsDeleted`
- Sync uses SHA-based change detection — unchanged files are skipped

### API Contract
```
POST /api/sync
Headers: Authorization: Bearer <SYNC_API_KEY>  (if SYNC_API_KEY is set)

Response 200:
{ "success": true, "message": "Sync completed successfully", postsAdded, postsUpdated, postsDeleted }

Response 401:
{ "error": "Unauthorized" }

Response 500:
{ "success": false, "error": "<message>" }
```

## Dependencies

### Internal
- `@/lib/sync-github` → `syncGitHubToDatabase()`

### External
- Requires `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` env vars (consumed by `lib/github.ts`)

<!-- MANUAL: -->
