<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-04-01 -->

# app/api/sync

## Purpose
POST/GET endpoint that triggers a full GitHub-to-database sync. GitHub 저장소에서 마크다운 파일을 가져와 MySQL에 upsert하고, 이미지 상대경로를 GitHub raw URL로 변환하여 저장한다. 수동 호출 또는 cron job 용도.

## Key Files

| File | Description |
|------|-------------|
| `route.ts` | `POST /api/sync` (and `GET` for dev convenience) — validates Bearer token then calls `syncGitHubToDatabase()` + `retitleExistingPosts()` |

## For AI Agents

### Working In This Directory
- Protected by `SYNC_API_KEY` env var — if set, requests must include `Authorization: Bearer <key>`
- `GET` is an alias for `POST` for development convenience; keep this in mind when testing
- Returns sync statistics: `postsAdded`, `postsUpdated`, `postsDeleted`
- Sync uses SHA-based change detection — unchanged files are skipped
- **이미지 처리**: sync 과정에서 `rewriteImagePaths()`가 자동 호출되어 `./images/foo.png` 형태의 상대경로가 GitHub raw URL로 변환된 후 DB에 저장됨

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
- `@/services/SyncService` → 동기화 오케스트레이션

### External
- Requires `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` env vars (`src/infra/github/client.ts`에서 소비)

<!-- MANUAL: -->
