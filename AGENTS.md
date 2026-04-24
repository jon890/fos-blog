<!-- Generated: 2026-03-17 | Updated: 2026-04-01 -->

# fos-blog

## Project Overview

`fos-blog` is a developer blog application built with Next.js 16 that automatically synchronizes and renders Markdown content from a specific GitHub repository (`jon890/fos-study`). It is designed to serve as a knowledge base, categorizing content into topics like AI, Algorithm, Architecture, etc.

### Key Features

- **GitHub Sync:** Fetches Markdown files from a remote repository via GitHub API.
- **Database Caching:** Caches content in a MySQL database using Drizzle ORM for faster access and search.
- **Categorization:** Automatically categorizes posts based on the directory structure of the source repository.
- **Markdown Rendering:** Renders GFM (GitHub Flavored Markdown) with syntax highlighting (highlight.js github-dark theme) and Mermaid diagram support.
- **Comments:** Per-post comment system stored in MySQL.
- **Visit Tracking:** Records and aggregates post view counts.
- **Responsive Design:** Built with Tailwind CSS v4 and fully responsive.
- **Dark/Light Mode:** Integrated theme switching (defaults to dark).

### Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 + `@tailwindcss/typography`
- **Database:** MySQL 8.4 (running via Docker Compose in `local/`)
- **ORM:** Drizzle ORM
- **GitHub Integration:** Octokit (`src/infra/github/`)
- **Logging:** pino (구조화 JSON 로그, 개발 환경에서 pino-pretty)
- **Package Manager:** pnpm

## Building and Running

### Prerequisites

- Node.js (v22+, see `.tool-versions`)
- pnpm
- Docker & Docker Compose (for the database)

### Initial Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Environment Configuration:**
   Copy `.env.example` to `.env` and configure:

   ```bash
   cp .env.example .env
   ```

   Required variables:
   - `GITHUB_TOKEN`: GitHub Personal Access Token
   - `GITHUB_OWNER`: Owner of the content repo (default: `jon890`)
   - `GITHUB_REPO`: Name of the content repo (default: `fos-study`)
   - `DATABASE_URL`: Connection string for MySQL (e.g., `mysql://fos_user:fos_password@localhost:13307/fos_blog`)
   - `SYNC_API_KEY`: API key to protect the `/api/sync` endpoint

3. **Start Database:**

   ```bash
   pnpm db:up
   ```

4. **Database Migration:**

   ```bash
   pnpm db:push
   ```

5. **Sync Content from GitHub:**
   ```bash
   curl -X POST http://localhost:3000/api/sync -H "Authorization: Bearer <SYNC_API_KEY>"
   ```

### Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

### Database Management

```bash
pnpm db:studio    # Drizzle Studio GUI
pnpm db:push      # Apply schema changes
pnpm db:generate  # Generate migration files
pnpm db:up        # Start MySQL container
pnpm db:down      # Stop MySQL container
```

## Project Structure

```
fos-blog/
├── src/
│   ├── app/          # Next.js App Router (pages + API routes)
│   ├── components/   # Reusable React UI components
│   ├── services/     # Business logic (SyncService, PostService, etc.)
│   ├── infra/
│   │   ├── db/       # Drizzle ORM — schema, repositories, connection
│   │   └── github/   # GitHub API client (Octokit)
│   ├── lib/          # Shared utilities (markdown, logger, path-utils)
│   └── proxy.ts      # Next.js middleware — visit count recording
├── local/            # Local dev environment (Docker Compose, MySQL init)
├── drizzle/          # Drizzle migration artifacts (auto-generated)
├── public/           # Static assets
├── CLAUDE.md         # AI agent project context (authoritative)
└── AGENTS.md         # This file
```

## Data Flow

```
GitHub Repository (jon890/fos-study)
    ↓
POST /api/sync → SyncService
    ↓
├── PostSyncService: 파일 동기화 (추가/수정/삭제)
└── MetadataSyncService: 메타데이터 갱신 (제목, 설명)
    ↓
PostRepository → MySQL (posts 테이블)
    ↓
GET /posts/[...slug] → PostService → MarkdownRenderer
    ↓
Browser (Markdown + GFM + Mermaid + 문법 강조)
```

## Development Conventions

- **Routing:** Next.js App Router file-system based routing.
- **Data Fetching:** Server-side fetching preferred. Content served from MySQL, populated via sync.
- **Styling:** Utility-first CSS using Tailwind v4. **Important:** `src/app/globals.css` must have `@source` directives for all directories containing Tailwind classes.
- **Type Safety:** Strict TypeScript. Drizzle schema provides type inference.
- **Logging:** pino 로거 사용 (`src/lib/logger.ts`). `console.log` 대신 `logger.child({ module: '...' })`를 사용한다.
- **Content Updates:** Modify source files in `jon890/fos-study` GitHub repo, then trigger `/api/sync`.

## Subdirectories

| Directory / File    | Purpose                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `CLAUDE.md`         | AI 에이전트용 프로젝트 컨텍스트 문서 — 기술 스택, 디렉토리 구조, 컨벤션, 환경변수 상세 정리            |
| `src/proxy.ts`      | Next.js middleware — records page visits to DB via `waitUntil` (fire-and-forget); runs on Edge Runtime |
| `src/app/`          | Next.js pages and API routes (see `src/app/AGENTS.md`)                                                 |
| `src/components/`   | Reusable React UI components (see `src/components/AGENTS.md`)                                          |
| `src/services/`     | Business logic layer — SyncService, PostService (see `src/services/AGENTS.md`)                         |
| `src/infra/db/`     | Database schema and repositories (see `src/infra/db/AGENTS.md`)                                        |
| `src/infra/github/` | GitHub API client and utilities (see `src/infra/github/AGENTS.md`)                                     |
| `src/lib/`          | Shared utilities — markdown, logger, path-utils (see `src/lib/AGENTS.md`)                              |
| `local/`            | Docker MySQL config (see `local/AGENTS.md`)                                                            |
