# fos-blog

## Project Overview

`fos-blog` is a developer blog application built with Next.js 16 that automatically synchronizes and renders Markdown content from a specific GitHub repository (`jon890/fos-study`). It is designed to serve as a knowledge base, categorizing content into topics like AI, Algorithm, Architecture, etc.

### Key Features

*   **GitHub Sync:** Fetches Markdown files from a remote repository via GitHub API.
*   **Database Caching:** Caches content in a MySQL database using Drizzle ORM for faster access and search.
*   **Categorization:** Automatically categorizes posts based on the directory structure of the source repository.
*   **Markdown Rendering:** Renders GFM (GitHub Flavored Markdown) with syntax highlighting.
*   **Responsive Design:** Built with Tailwind CSS v4 and fully responsive.
*   **Dark/Light Mode:** Integrated theme switching.

### Tech Stack

*   **Framework:** Next.js 16 (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS v4
*   **Database:** MySQL 8.4 (running via Docker)
*   **ORM:** Drizzle ORM
*   **GitHub Integration:** Octokit
*   **Package Manager:** pnpm

## Building and Running

### Prerequisites

*   Node.js (v20+ recommended)
*   pnpm
*   Docker & Docker Compose (for the database)

### Initial Setup

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Environment Configuration:**
    Copy `.env.example` to `.env.local` and configure your GitHub credentials.
    ```bash
    cp .env.example .env.local
    ```
    Required variables:
    *   `GITHUB_TOKEN`: GitHub Personal Access Token (for API rate limits)
    *   `GITHUB_OWNER`: Owner of the content repo (default: `jon890`)
    *   `GITHUB_REPO`: Name of the content repo (default: `fos-study`)
    *   `DATABASE_URL`: Connection string for MySQL (e.g., `mysql://fos_user:fos_password@localhost:13307/fos_blog`)

3.  **Start Database:**
    ```bash
    docker compose up -d
    ```

4.  **Database Migration & Sync:**
    Initialize the database schema and sync content from GitHub.
    ```bash
    pnpm db:push
    pnpm sync
    ```

### Development Server

Start the Next.js development server:

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

### Database Management

*   **Studio (GUI):** View and manage data via Drizzle Studio.
    ```bash
    pnpm db:studio
    ```
*   **Push Schema:** Update database schema after modifying `db/schema.ts`.
    ```bash
    pnpm db:push
    ```

## Project Structure

*   `app/`: Next.js App Router pages and layouts.
    *   `api/`: API routes (e.g., search, sync triggers).
    *   `categories/`, `category/`, `posts/`: Page routes for different views.
*   `components/`: Reusable React components (UI, Markdown renderer, etc.).
*   `db/`: Database configuration and schema definitions (`schema.ts`).
*   `drizzle/`: Drizzle migration artifacts.
*   `lib/`: Utility functions, including GitHub API logic (`github.ts`) and syncing logic (`sync-github.ts`).
*   `public/`: Static assets.
*   `scripts/`: Standalone scripts (e.g., `sync.ts` for CLI synchronization).

## Development Conventions

*   **Routing:** Uses Next.js App Router file-system based routing.
*   **Data Fetching:** Prefers server-side fetching where possible. Content is primarily served from the MySQL database, which is populated via the sync process.
*   **Styling:** Utility-first CSS using Tailwind.
*   **Type Safety:** Strict TypeScript usage. Drizzle schema definitions provide type inference for database models.
*   **Sync Logic:** The `sync` command is the source of truth for content. Changes should be made in the source GitHub repository, then synced to this application.
