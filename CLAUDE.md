# fos-blog — Claude Code Project Context

**Updated:** 2026-04-01 | **Repo:** github.com/jon890/fos-blog | **Live:** https://fosworld.co.kr

---

## What This Is

Next.js 16 developer blog that syncs Markdown from `jon890/fos-study` (GitHub) → MySQL → renders with GFM/mermaid. Features: categorization, dark/light mode, visit tracking, comments, full-text search.

**Deployment: Home server (Docker + standalone Next.js). NOT Vercel.**

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Language | TypeScript 5.7 (strict) |
| Styling | Tailwind CSS 4.0 + @tailwindcss/typography |
| Database | MySQL 8.4 (Docker) + Drizzle ORM 0.45.1 |
| GitHub API | @octokit/rest 21.0.0 |
| Markdown | react-markdown + remark-gfm + rehype-highlight + rehype-slug + mermaid |
| Logging | pino (JSON) + pino-pretty (dev only) |
| Testing | Vitest 4.1.0 |
| Package mgr | pnpm 9.15.0 |

---

## Directory Structure

```
fos-blog/
├── src/
│   ├── app/              # Next.js App Router (pages + API routes)
│   ├── components/       # Reusable React UI components
│   ├── services/         # Business logic (SyncService, PostService, etc.)
│   ├── infra/
│   │   ├── db/           # Drizzle ORM — schema/, repositories/
│   │   └── github/       # Octokit client, API, file-filter, image-rewrite
│   ├── lib/              # Shared utils — markdown.ts, logger.ts, path-utils.ts
│   └── proxy.ts          # Middleware — visit count via waitUntil() (Edge Runtime)
├── local/                # Docker Compose + MySQL init.sql
├── drizzle/              # Migration artifacts (auto-generated, do not edit)
├── Dockerfile            # Multi-stage build (output: standalone)
└── AGENTS.md             # Directory delegation guide
```

See `src/AGENTS.md` for full layered architecture details.

---

## Key Scripts

```bash
pnpm dev           # Dev server (http://localhost:3000)
pnpm build         # Production build
pnpm lint          # ESLint
pnpm type-check    # tsc --noEmit
pnpm test          # Vitest

pnpm db:up         # Start MySQL container
pnpm db:down       # Stop MySQL container
pnpm db:push       # Apply schema changes
pnpm db:generate   # Generate migration files
pnpm db:studio     # Drizzle Studio GUI
pnpm setup         # db:up + db:push (first-time setup)
```

---

## Environment Variables

```env
# Required
GITHUB_TOKEN=ghp_...               # GitHub PAT
GITHUB_OWNER=jon890
GITHUB_REPO=fos-study
DATABASE_URL=mysql://fos_user:fos_password@localhost:13307/fos_blog
SYNC_API_KEY=...                   # Protects POST /api/sync

# Public / SEO
NEXT_PUBLIC_SITE_URL=https://fosworld.co.kr
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=...
NEXT_PUBLIC_GOOGLE_ADSENSE_ID=ca-pub-...
```

See `.env.example` for full list.

---

## Conventions

- **Routing:** Next.js App Router (file-system based)
- **Components:** PascalCase, named exports, no direct DB calls
- **TypeScript:** strict mode, `@/*` path alias, `_` prefix for unused vars
- **Tailwind:** `src/app/globals.css` must include `@source` for every dir with Tailwind classes
- **Logging:** `logger.child({ module: '...' })` from `@/lib/logger` — no `console.log`
- **Error handling:** `err: error instanceof Error ? error : new Error(String(error))`
- **Tests:** co-located `*.test.ts`, Vitest, mock repositories with `vi.mock()`
- **API routes:** Bearer token auth via `SYNC_API_KEY`

---

## Architecture

```
app/ (routing)
  ↓
services/ (business logic)
  ↓
infra/db/ + infra/github/ (external systems)
  ↑
lib/ (shared utils — used everywhere)
```

- `app/` should not import directly from `infra/` — go through `services/`
- Schema source of truth: `src/infra/db/schema/` — run `pnpm db:push` after changes
- `posts.path` = canonical GitHub file path (unique key, not `slug`)
- `posts.isActive` = soft delete — always filter `eq(posts.isActive, true)`

---

## Home Server Deployment

**Not Vercel.** Do NOT suggest Vercel Cron, Edge Functions, or Vercel-specific ISR invalidation.

```bash
docker build -t fos-blog .
docker run -d --name fos-blog -p 3000:3000 --env-file .env fos-blog
```

Content sync cron (crontab):
```bash
0 * * * * curl -s -X POST http://localhost:3000/api/sync -H "Authorization: Bearer $SYNC_API_KEY"
```

---

## Subdirectory Agent Docs

- `src/AGENTS.md` — architecture overview
- `src/app/AGENTS.md` — pages, API routes
- `src/components/AGENTS.md` — UI components
- `src/services/AGENTS.md` — business logic
- `src/infra/db/AGENTS.md` — schema, repositories
- `src/infra/github/AGENTS.md` — GitHub API client
- `src/lib/AGENTS.md` — shared utilities
- `local/AGENTS.md` — MySQL Docker setup

---

## Summary for Agents

**Next.js 16 blog with layered architecture: app → services → infra.**

- **Key files:** `src/services/SyncService.ts`, `src/app/api/sync/route.ts`, `src/components/MarkdownRenderer.tsx`, `src/infra/db/schema/posts.ts`
- **Deployment:** Home server (Docker + standalone Next.js) + MySQL (Docker Compose)
- **Testing:** Vitest + co-located test files

**Agents should prioritize:**
1. Schema integrity (Drizzle types)
2. Sync idempotency (no duplicate/lost data)
3. Markdown fidelity (GFM, mermaid, links)
4. Type safety across API boundaries
