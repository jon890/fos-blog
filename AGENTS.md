<!-- Generated: 2026-03-17 | Updated: 2026-03-20 -->

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
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + `@tailwindcss/typography`
- **Database:** MySQL 8.4 (running via Docker)
- **ORM:** Drizzle ORM
- **GitHub Integration:** Octokit
- **Package Manager:** pnpm

## Building and Running

### Prerequisites

- Node.js (v20+ recommended, see `.tool-versions`)
- pnpm
- Docker & Docker Compose (for the database)

### Initial Setup

1.  **Install dependencies:**

    ```bash
    pnpm install
    ```

2.  **Environment Configuration:**
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

3.  **Start Database:**

    ```bash
    docker compose up -d
    # or
    pnpm db:up
    ```

4.  **Database Migration:**

    ```bash
    pnpm db:push
    ```

5.  **Sync Content from GitHub:**
    ```bash
    curl -X GET http://localhost:3000/api/sync -H "Authorization: Bearer <SYNC_API_KEY>"
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

- `app/`: Next.js App Router pages, layouts, and API routes.
  - `api/comments/`: Comment CRUD API
  - `api/search/`: Full-text post search API
  - `api/sync/`: GitHub→DB sync trigger API
  - `api/visit/`: Post view count tracking API
  - `categories/`, `category/`, `posts/`: Page routes
  - `globals.css`: Global Tailwind CSS — **must include `@source` for both `app/` and `components/`**
- `components/`: Reusable React components (MarkdownRenderer, TableOfContents, Comments, etc.).
- `db/`: Database layer — Drizzle connection, schema definitions (`db/schema/`), and repository classes (`db/repositories/`).
- `drizzle/`: Drizzle migration artifacts (auto-generated, do not edit).
- `lib/`: Utility functions — GitHub API client, markdown processing, sync orchestration.
- `docker/`: MySQL Docker initialization scripts.
- `public/`: Static assets.

## Development Conventions

- **Routing:** Next.js App Router file-system based routing.
- **Data Fetching:** Server-side fetching preferred. Content served from MySQL, populated via sync.
- **Styling:** Utility-first CSS using Tailwind v4. **Important:** `app/globals.css` must have `@source` directives for all directories containing Tailwind classes (currently `app/` and `components/`).
- **Type Safety:** Strict TypeScript. Drizzle schema provides type inference.
- **Content Updates:** Modify source files in `jon890/fos-study` GitHub repo, then trigger `/api/sync`.

## Subdirectories

| Directory     | Purpose                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `proxy.ts`    | Next.js middleware — records page visits to DB via `waitUntil` (fire-and-forget); runs on Edge Runtime |
| `app/`        | Next.js pages and API routes (see `app/AGENTS.md`)                                                     |
| `components/` | Reusable React UI components (see `components/AGENTS.md`)                                              |
| `db/`         | Database schema and repositories (see `db/AGENTS.md`)                                                  |
| `lib/`        | Shared utilities and GitHub sync (see `lib/AGENTS.md`)                                                 |
| `docker/`     | Docker MySQL config (see `docker/AGENTS.md`)                                                           |
