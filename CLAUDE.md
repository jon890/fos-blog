# fos-blog — Claude Code Project Context

**Generated:** 2026-03-29  
**Project:** FOS Study Blog  
**Repository:** github.com/jon890/fos-blog

---

## Executive Summary

`fos-blog` is a Next.js 16 developer blog that automatically synchronizes Markdown content from a remote GitHub repository (`jon890/fos-study`), caches it in MySQL via Drizzle ORM, and renders it with full Markdown/GFM support. The blog features categorization, dark/light mode, visit tracking, comments, and ISR caching.

---

## Tech Stack

### Core Framework & Runtime

- **Node.js:** 22.18.0 (via `.tool-versions`)
- **Framework:** Next.js 16.1.6 (App Router + Turbopack)
- **Language:** TypeScript 5.7 (strict mode enabled)
- **Package Manager:** pnpm 9.15.0 (pinned in `package.json`)

### UI & Styling

- **React:** 19.2.0
- **Styling:** Tailwind CSS 4.0 + `@tailwindcss/typography`
- **Icons:** lucide-react 0.469.0
- **Fonts:** Google Fonts (Noto Sans KR + JetBrains Mono)
- **Theme Management:** next-themes 0.4.4

### Markdown & Content Rendering

- **Markdown Parser:** react-markdown 9.0.1
- **Markdown Plugins:**
  - remark-gfm 4.0.0 (GitHub Flavored Markdown)
  - rehype-highlight 7.0.0 (syntax highlighting)
  - rehype-raw 7.0.0 (raw HTML passthrough)
  - rehype-slug 6.0.0 (auto heading slugs)
- **Syntax Highlighting:** highlight.js 11.11.1 (github-dark theme)
- **Diagrams:** mermaid 11.12.2

### Database & ORM

- **Database:** MySQL 8.4 (running via Docker Compose)
- **ORM:** Drizzle ORM 0.45.1
- **Migration Tool:** drizzle-kit 0.31.8
- **Driver:** mysql2 3.16.2

### GitHub Integration

- **API Client:** @octokit/rest 21.0.0

### Security & Auth

- **Password Hashing:** bcryptjs 3.0.3

### Dev Tools

- **Linter:** ESLint 9.17.0 + TypeScript ESLint
- **Type Checker:** tsc (via `pnpm type-check`)
- **Test Runner:** Vitest 4.1.0
- **Type Definitions:** @types/react 19.0, @types/node 22.10.0
- **Build Transpiler:** tsx 4.21.0
- **Environment Manager:** dotenv 17.2.3

### Development Dependencies

- ESLint plugins: react, react-hooks
- ESLint config: eslint-config-next, @eslint/js, typescript-eslint
- Post-CSS: @tailwindcss/postcss 4.0.0

---

## Directory Structure

```
fos-blog/
├── app/                          # Next.js App Router pages and API routes
│   ├── layout.tsx                # Root layout (metadata, fonts, providers)
│   ├── page.tsx                  # Home page
│   ├── globals.css               # Global Tailwind CSS (MUST include @source directives)
│   ├── api/
│   │   ├── comments/             # Comment CRUD endpoints
│   │   ├── search/               # Full-text post search API
│   │   ├── sync/                 # GitHub→DB sync trigger (POST /api/sync)
│   │   └── visit/                # Post view count tracking
│   ├── categories/               # /categories route (all categories list)
│   ├── category/[category]/      # /category/[category] (posts in category)
│   ├── posts/[...slug]/          # /posts/[...slug] (post detail page)
│   ├── ads.txt                   # Google AdSense configuration
│   └── components/               # App-specific components (sidebar, etc.)
├── components/                   # Reusable React UI components
│   ├── Header.tsx
│   ├── PostCard.tsx
│   ├── CategoryCard.tsx
│   ├── MarkdownRenderer.tsx
│   ├── ThemeToggle.tsx
│   ├── ThemeProvider.tsx
│   ├── Comments.tsx
│   ├── TableOfContents.tsx
│   ├── SidebarContext.tsx        # Context for folder sidebar state
│   └── ...
├── db/                           # Database layer
│   ├── index.ts                  # Drizzle connection (neon, mysql, etc.)
│   ├── schema/                   # Drizzle schema definitions
│   │   ├── posts.ts              # Posts table + types
│   │   ├── comments.ts           # Comments table + types
│   │   ├── visitStats.ts         # Visit tracking table
│   │   ├── folders.ts            # Folder/category hierarchy
│   │   └── syncLogs.ts           # Sync operation logs
│   └── repositories/             # Data access layer (repository pattern)
│       ├── postRepository.ts
│       ├── commentRepository.ts
│       └── ...
├── lib/                          # Shared utilities
│   ├── sync-github.ts            # GitHub API client + core sync logic (fetch + cache + reconciliation)
│   ├── markdown.ts               # Markdown parsing (frontmatter, title, TOC)
│   ├── resolve-markdown-link.ts  # Markdown link resolver (GitHub → blog URLs)
│   ├── markdown.test.ts          # Unit tests for markdown utilities
│   ├── sync-github.test.ts       # Unit tests for sync logic
│   └── resolve-markdown-link.test.ts
├── docker/                       # Docker configuration
│   └── mysql/
│       └── init.sql              # MySQL initialization script
├── drizzle/                      # Drizzle migration artifacts (auto-generated)
├── public/                       # Static assets
├── proxy.ts                      # Next.js middleware (records page visits via waitUntil)
├── next.config.js                # Next.js config (output: standalone, image patterns)
├── drizzle.config.ts             # Drizzle config (MySQL dialect, ./db/schema path)
├── tsconfig.json                 # TypeScript config (strict: true, paths: @/*)
├── eslint.config.mjs             # ESLint config (TS + React rules)
├── postcss.config.mjs            # PostCSS config for Tailwind
├── docker-compose.yml            # MySQL 8.4 container (port 13307)
├── Dockerfile                    # Multi-stage build for production
├── package.json                  # Dependencies + scripts
├── pnpm-lock.yaml                # Lockfile (pnpm)
├── .env.example                  # Example environment variables
├── .tool-versions                # Node/pnpm versions (asdf/mise)
├── .gitignore
├── README.md                     # User-facing documentation
├── AGENTS.md                     # Agent delegation guide (app/, components/, db/, lib/, docker/)
└── CLAUDE.md                     # This file
```

---

## Key Scripts

### Package Manager

```bash
pnpm install                 # Install dependencies
```

### Development

```bash
pnpm dev                     # Start dev server with Turbopack (http://localhost:3000)
pnpm type-check              # Run tsc --noEmit
pnpm lint                    # Run ESLint
pnpm test                    # Run Vitest
```

### Production

```bash
pnpm build                   # Next.js production build
pnpm start                   # Start production server
```

### Database

```bash
pnpm db:up                   # Start MySQL container (docker compose up -d)
pnpm db:down                 # Stop MySQL container (docker compose down)
pnpm db:generate             # Generate Drizzle migration files
pnpm db:push                 # Apply schema to database
pnpm db:migrate              # Run pending migrations
pnpm db:studio               # Open Drizzle Studio GUI
pnpm db:logs                 # Tail MySQL container logs
pnpm setup                   # Full setup: db:up + sleep 5 + db:push
```

### Content Sync

- **Manual:** `curl -X POST http://localhost:3000/api/sync -H "Authorization: Bearer <SYNC_API_KEY>"`
- **Cron:** Configure a cron job to POST `/api/sync` periodically for automated sync

---

## Environment Variables

See `/Users/nhn/personal/fos-blog/.env.example` for the full list.

### Required (for basic dev)

```env
GITHUB_TOKEN=ghp_xxxxx                          # GitHub PAT (for API rate limit lift)
GITHUB_OWNER=jon890                             # Content repo owner
GITHUB_REPO=fos-study                           # Content repo name
```

### Database (for MySQL caching)

```env
DATABASE_URL=mysql://fos_user:fos_password@localhost:13307/fos_blog
```

### Sync Protection

```env
SYNC_API_KEY=your_random_api_key_here          # Protects /api/sync endpoint
```

### Public/SEO

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.com            # For canonical URLs & sitemap
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=xxx                # Google Search Console
NEXT_PUBLIC_GOOGLE_ADSENSE_ID=ca-pub-xxx               # Google AdSense
```

---

## Database Schema

### Tables

**posts** — Main content table

- `id` (INT): Primary key, auto-increment
- `title` (VARCHAR 500): Post title (required, indexed)
- `path` (VARCHAR 500): GitHub file path (required, unique)
- `slug` (VARCHAR 500): URL slug (required, indexed)
- `category` (VARCHAR 255): Primary category (indexed)
- `subcategory` (VARCHAR 255): Secondary category
- `folders` (JSON): n-depth folder path array (e.g., `["algorithms", "sorting", "quicksort"]`)
- `content` (TEXT): Full rendered markdown
- `description` (TEXT): Extracted excerpt
- `sha` (VARCHAR 64): GitHub file SHA (for change detection)
- `isActive` (BOOLEAN): Soft delete flag (default: true)
- `createdAt`, `updatedAt` (TIMESTAMP): Timestamps

**comments** — Per-post comments

- `id` (INT): Primary key
- `postId` (INT): Foreign key to posts
- `author` (VARCHAR): Commenter name
- `email` (VARCHAR): Commenter email
- `content` (TEXT): Comment text
- `createdAt` (TIMESTAMP)

**visitStats** — Page view tracking

- `id` (INT): Primary key
- `postId` (INT): Foreign key to posts
- `viewCount` (INT): Total views
- `updatedAt` (TIMESTAMP): Last updated

**syncLogs** — Sync operation history

- `id` (INT): Primary key
- `commitSha` (VARCHAR): GitHub commit SHA
- `postsAdded`, `postsUpdated`, `postsDeleted` (INT): Change counts
- `createdAt` (TIMESTAMP)

**folders** — Directory nodes with optional README content

- `id` (INT): Primary key
- `path` (VARCHAR): Full folder path, unique (e.g. `AI/RAG`)
- `readme` (TEXT): README.md content if present
- `sha` (VARCHAR 64): GitHub SHA for change detection

---

## Database Setup

### 1. Start MySQL Container

```bash
pnpm db:up
# Waits 10s for health check
```

### 2. Apply Schema

```bash
pnpm db:push
# Or: pnpm db:generate (creates migrations), then pnpm db:migrate
```

### 3. Verify Connection

```bash
pnpm db:studio
# Opens Drizzle Studio at http://local.drizzle.studio
```

### 4. Populate with GitHub Data

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer $SYNC_API_KEY" \
  -H "Content-Type: application/json"
```

---

## Key Conventions

### File & Naming

- **App routes:** File-system based (Next.js App Router)
- **Components:** PascalCase (e.g., `MarkdownRenderer.tsx`)
- **Utils/helpers:** camelCase (e.g., `extractTitle()`, `syncGitHubToDatabase()`)
- **Constants:** SCREAMING_SNAKE_CASE (e.g., `OWNER`, `REPO`)
- **Exports:** Named exports preferred; type inference via Drizzle schema

### TypeScript

- **Strict mode:** Enabled (`tsconfig.json`)
- **Type safety:** Drizzle provides inferred types from schema (e.g., `Post`, `NewPost`)
- **Path aliases:** `@/*` → project root
- **Unused vars:** `_` prefix to suppress warnings (ESLint rule)

### Styling

- **Tailwind CSS v4 with `@source` directives**
  - `app/globals.css` MUST include: `@source "./app"` and `@source "./components"`
  - New component directories require `@source` updates
- **Typography plugin:** Used for markdown rendering (`.prose` classes)
- **Dark mode:** `next-themes` provider + `[data-theme="dark"]` or `dark:` utilities

### Data Flow

1. **GitHub sync:** `POST /api/sync` → `syncGitHubToDatabase()` → fetch files → parse metadata
2. **Cache:** Files stored in MySQL (posts table)
3. **Rendering:** App routes query DB → pass to `MarkdownRenderer` → browser
4. **Updates:** Only synced files update; soft-delete inactive posts

### Testing

- **Test files:** Co-located with source (e.g., `markdown.test.ts` next to `markdown.ts`)
- **Test runner:** Vitest 4.1.0
- **Run tests:** `pnpm test`

### Middleware & Hooks

- **proxy.ts:** Next.js middleware — records page visits to DB via `waitUntil()` (fire-and-forget)
- **Edge Runtime:** Lightweight, fires async without blocking response

### API Routes (next-server)

- **Location:** `app/api/*/route.ts`
- **Pattern:** Endpoint-per-directory (e.g., `app/api/sync/route.ts`)
- **Auth:** Bearer token check (SYNC_API_KEY)

---

## Code Structure Patterns

### GitHub Sync

**File:** `/Users/nhn/personal/fos-blog/lib/sync-github.ts`

```typescript
export function shouldSyncFile(filename: string): boolean;
export function rewriteImagePaths(content: string, filePath: string): string;
export async function syncGitHubToDatabase(): Promise<SyncResult>;
export async function retitleExistingPosts(): Promise<RetitleResult>;
```

**Flow:**

1. Fetch tree from GitHub API (Octokit)
2. Walk directory tree, filter `.md` files via `shouldSyncFile()`
3. Fetch content, rewrite image paths (GitHub raw → blog URLs)
4. Parse frontmatter + extract title/description
5. Upsert into posts table (by path, unique key)
6. Mark inactive posts if deleted from source

### Markdown Processing

**File:** `/Users/nhn/personal/fos-blog/lib/markdown.ts`

```typescript
export function parseFrontMatter(content: string);
export function extractTitle(content: string): string | null;
export function extractDescription(content: string): string | null;
export function getReadingTime(content: string): number;
export function generateTableOfContents(content: string): TocItem[];
```

### Link Resolution

**File:** `/Users/nhn/personal/fos-blog/lib/resolve-markdown-link.ts`

Converts GitHub raw URLs to blog relative URLs for inter-post links.

### Markdown Rendering Component

**File:** `/Users/nhn/personal/fos-blog/components/MarkdownRenderer.tsx`

Uses `react-markdown` + plugins (remark-gfm, rehype-highlight, etc.) to render GFM + code highlighting + mermaid.

---

## Common Tasks

### Add a New Page Route

1. Create file in `app/` (e.g., `app/about/page.tsx`)
2. Export default React component
3. Next.js auto-routes via file path

### Modify Tailwind Styles

1. Edit `app/globals.css` or add inline `className=""`
2. If creating new component directory: update `@source` directives in `globals.css`
3. Rebuild with `pnpm build` (Turbopack watches `dev`)

### Add a New API Endpoint

1. Create `app/api/myendpoint/route.ts`
2. Export `GET`, `POST`, etc. functions
3. Use `NextResponse` for type-safe responses

### Sync Content from GitHub

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer ${SYNC_API_KEY}"
```

### Query Posts from DB

```typescript
import { db } from "@/db";
import { posts } from "@/db/schema/posts";

const allPosts = await db.select().from(posts);
const byCategory = await db
  .select()
  .from(posts)
  .where(eq(posts.category, "AI"));
```

### Run Tests

```bash
pnpm test                    # All tests
pnpm test -- lib/markdown   # Specific file
```

---

## Performance & Optimization

### ISR (Incremental Static Regeneration)

- Blog posts cached for 1 hour (`revalidate: 3600`)
- Sync endpoint invalidates cache on success (via Vercel API)

### Image Optimization

- Remote GitHub images: `next/image` with `remotePatterns` config
- Allowed hostnames: `raw.githubusercontent.com`, `github.com`

### Markdown Rendering

- Syntax highlighting via highlight.js (client-side)
- Mermaid diagrams supported (lazy-loaded)

### Database Queries

- Indexed columns: `category`, `slug`
- Soft-delete via `isActive` flag (prevents orphaned data)

---

## Known Limitations & TODOs

- **TODO/FIXME markers:** 165 found in codebase (see `lib/sync-github.test.ts`, etc.)
- **Image rewriting:** Currently rewrites only GitHub raw URLs; non-GitHub CDNs not handled
- **Rate limiting:** GitHub API limits at 60 req/hr (unauthenticated) or 5000 req/hr (with token)
- **Sync idempotency:** Uses GitHub file SHA to detect changes; force-resync requires manual deletion

---

## Home Server Deployment

This project runs on a **self-hosted home server** (not Vercel). The Next.js app is built as a standalone output and runs inside Docker.

### Build & Run

```bash
# Build Docker image
docker build -t fos-blog .

# Run container (adjust env vars as needed)
docker run -d \
  --name fos-blog \
  -p 3000:3000 \
  --env-file .env \
  fos-blog
```

### Environment Variables

Set these in your `.env` file or pass via `--env-file`:

```env
GITHUB_TOKEN=...
GITHUB_OWNER=jon890
GITHUB_REPO=fos-study
DATABASE_URL=mysql://...
SYNC_API_KEY=...
NEXT_PUBLIC_SITE_URL=https://fosworld.co.kr
```

### Content Sync Cron

Configure a system cron job (or `crontab`) to POST `/api/sync` periodically:

```bash
# crontab -e
0 * * * * curl -s -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer $SYNC_API_KEY" > /dev/null
```

### Notes for Agents

- **Do NOT suggest Vercel-specific features** (Vercel Cron, Edge Functions, ISR via Vercel API, etc.)
- `pino.transport()` worker thread usage is fine — home server runs Node.js, not serverless
- `next.config.js` uses `output: "standalone"` for Docker builds

---

## Subdirectory Agent Docs

Each major directory has an `AGENTS.md` file for delegation:

- `app/AGENTS.md` — Page routes, API routes, layout
- `components/AGENTS.md` — UI components
- `db/AGENTS.md` — Schema, repositories, migrations
- `lib/AGENTS.md` — Utilities, sync, markdown
- `docker/AGENTS.md` — MySQL setup, Docker Compose

See these files for detailed agent responsibilities.

---

## Useful Links

- **Repository:** https://github.com/jon890/fos-blog
- **Content Source:** https://github.com/jon890/fos-study
- **Live Blog:** https://fosworld.co.kr
- **Next.js Docs:** https://nextjs.org/docs
- **Drizzle ORM Docs:** https://orm.drizzle.team
- **Tailwind CSS Docs:** https://tailwindcss.com/docs

---

## Summary for Claude Code Agents

**This is a Next.js 16 full-stack blog with GitHub sync, MySQL caching, and Markdown rendering.**

- **Primary concern:** Content sync consistency, markdown edge cases, performance
- **Key files to touch:** `lib/sync-github.ts`, `app/api/sync/route.ts`, `components/MarkdownRenderer.tsx`, `db/schema/posts.ts`
- **Testing:** Vitest + co-located test files
- **Deployment:** Home server (Docker + standalone Next.js) + MySQL (Docker Compose)

**Agents should prioritize:**

1. Maintaining schema integrity (Drizzle types)
2. Sync idempotency (no duplicate/lost data)
3. Markdown fidelity (GFM rendering, mermaid, links)
4. Type safety across API boundaries
