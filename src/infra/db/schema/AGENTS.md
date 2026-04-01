<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-20 | Updated: 2026-03-20 -->

# db/schema

## Purpose
Drizzle ORM table definitions. Each file defines one or more related tables and exports inferred TypeScript types. `index.ts` re-exports everything for convenient import.

## Key Files

| File | Description |
|------|-------------|
| `posts.ts` | `posts` table — title, path (unique), slug, category, subcategory, folders (JSON), content, description, sha, isActive |
| `categories.ts` | `categories` table — name (unique), slug (unique), icon, postCount |
| `folders.ts` | `folders` table — path (unique), readme, sha; represents directory nodes |
| `comments.ts` | `comments` table — postId (FK), author, content, createdAt |
| `syncLogs.ts` | `syncLogs` table — status, postsAdded/Updated/Deleted, error, syncedAt; audit trail for GitHub sync |
| `visitLogs.ts` | `visitLogs` table — raw per-request visit events |
| `visitStats.ts` | `visitStats` table — aggregated view counts per post path |
| `index.ts` | Barrel export for all schema definitions |

## For AI Agents

### Working In This Directory
- After modifying any schema file, run `pnpm db:generate` then `pnpm db:push` to apply changes
- `posts.sha` stores GitHub blob SHA — used for incremental sync; do not reset without understanding sync logic
- `posts.isActive` is a soft-delete flag — always filter by it in queries
- `posts.folders` is a JSON column storing breadcrumb path segments
- Import all schema via `@/db/schema` (the barrel index)

### Common Patterns
```ts
import { posts, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
const result = await db.select().from(posts).where(eq(posts.isActive, true));
```

## Dependencies

### External
- `drizzle-orm/mysql-core` — `mysqlTable`, `varchar`, `text`, `boolean`, `json`, etc.

<!-- MANUAL: -->
