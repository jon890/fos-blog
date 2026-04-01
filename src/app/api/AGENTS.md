<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-04-01 -->

# app/api

## Purpose
Next.js API route handlers. Two endpoints: full-text post search and GitHub-to-database sync. All routes follow the Next.js App Router `route.ts` convention.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `search/` | GET endpoint for post search — see `search/AGENTS.md` |
| `sync/` | POST/GET endpoint to trigger GitHub sync — see `sync/AGENTS.md` |
| `comments/` | CRUD endpoint for per-post comments — see `comments/AGENTS.md` |
| `visit/` | POST endpoint for recording post view counts — see `visit/AGENTS.md` |

## For AI Agents

### Working In This Directory
- New API routes go in `app/api/<name>/route.ts`
- Export named functions `GET`, `POST`, `PUT`, `DELETE` etc. — Next.js routes by HTTP method
- Use `NextRequest` / `NextResponse` from `next/server`
- Authentication is done via `Authorization: Bearer <SYNC_API_KEY>` header check in sync; replicate this pattern for any protected routes

### Common Patterns
```ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("key");
  return NextResponse.json({ data });
}
```

## Dependencies

### Internal
- `@/services/` — 비즈니스 로직 (PostService, SyncService 등)
- `@/infra/db/` — Drizzle 연결 (services를 통해 간접 접근 권장)

<!-- MANUAL: -->
