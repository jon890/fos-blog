<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-03-20 -->

# db

## Purpose
Database layer using Drizzle ORM with MySQL. Contains the schema definition, TypeScript types, query class, constants, and the database connection singleton. This is the authoritative data access layer — prefer it over `lib/db-queries.ts` for all new code.

## Key Files

| File | Description |
|------|-------------|
| `schema.ts` | Drizzle table definitions for `posts`, `categories`, `folders`, `syncLogs`; also exports inferred TypeScript types |
| `types.ts` | Application-level TypeScript types (`PostData`, `CategoryData`, `FolderItemData`, `FolderContentsResult`) used across the app |
| `index.ts` | Database connection singleton — creates and exports the `db` Drizzle instance |
| `queries.ts` | `DbQueries` class with all query methods; instantiated with the `db` connection |
| `constants.ts` | `categoryIcons` map (category name → emoji) and `DEFAULT_CATEGORY_ICON` fallback |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `schema/` | Drizzle table definitions, one file per entity (see `schema/AGENTS.md`) |
| `repositories/` | Repository classes for data access patterns (see `repositories/AGENTS.md`) |

## Schema Overview

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `posts` | id, title, path (unique), slug, category, subcategory, folders (JSON), content, description, sha, isActive | Markdown posts synced from GitHub |
| `categories` | id, name (unique), slug (unique), icon, postCount | Post categories derived from GitHub directory structure |
| `folders` | id, path (unique), readme, sha | Directory nodes with optional README content |
| `syncLogs` | id, status, postsAdded, postsUpdated, postsDeleted, error, syncedAt | Audit log for each GitHub sync run |

## For AI Agents

### Working In This Directory
- `posts.path` is the canonical identifier (GitHub file path e.g. `ai/intro.md`) — **not** `slug`
- `posts.sha` stores the GitHub blob SHA for incremental sync — do not clear it without understanding the sync logic
- `posts.isActive` soft-deletes posts; always filter `eq(posts.isActive, true)` in queries
- `posts.folders` is a JSON array of the path segments leading to the file (used for breadcrumbs)
- Search uses MySQL `FULLTEXT` index on `(title, content, description)` — falls back to `LIKE` if fulltext fails
- Schema changes require `pnpm db:generate` then `pnpm db:push` (or `pnpm db:migrate`)

### Testing Requirements
- Run `pnpm db:up` to start the MySQL Docker container before running queries
- Use `pnpm db:studio` to inspect data visually during development

### Common Patterns
```ts
// Instantiate queries (done in lib/db-queries.ts and API routes)
import { db } from "@/db";
import { DbQueries } from "@/db/queries";
const q = new DbQueries(db);

// Fetch posts with isActive filter (always include this)
const posts = await q.getPostsByCategory("ai");

// Search (tries FULLTEXT, falls back to LIKE)
const results = await q.searchPosts("react hooks", 10);

// Folder navigation
const { folders, posts, readme } = await q.getFolderContents("ai/basics");
```

## Dependencies

### Internal
- Used by `lib/sync-github.ts`, `lib/db-queries.ts`, and all API routes

### External
- `drizzle-orm` — ORM and query builder
- `mysql2` — MySQL client driver

<!-- MANUAL: -->
