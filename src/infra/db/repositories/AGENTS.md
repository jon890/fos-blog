<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-20 | Updated: 2026-03-20 -->

# db/repositories

## Purpose

Repository classes implementing data access patterns for each entity. Each repository extends `BaseRepository` and encapsulates all DB queries for its domain.

## Key Files

| File                    | Description                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `BaseRepository.ts`     | Abstract base class providing the shared `db` connection and common query utilities       |
| `PostRepository.ts`     | Queries for posts — fetch by slug/path, list by category, full-text search, active filter |
| `CategoryRepository.ts` | Queries for categories — list all, fetch by slug, post count aggregation                  |
| `FolderRepository.ts`   | Queries for folder nodes — fetch by path, list children                                   |
| `CommentRepository.ts`  | Queries for comments — list by postId, create, delete                                     |
| `VisitRepository.ts`    | Queries for visit tracking — record visit log, upsert visit stats                         |
| `index.ts`              | Barrel export for all repositories                                                        |

## For AI Agents

### Working In This Directory

- Always filter `posts` with `eq(posts.isActive, true)` — soft-deleted posts must be excluded
- `PostRepository` uses MySQL `FULLTEXT` index for search; falls back to `LIKE` on failure
- Extend `BaseRepository` when adding new repositories — do not create standalone query functions
- Import from `@/db/repositories` (the barrel) rather than individual files

### Common Patterns

```ts
import { PostRepository } from "@/db/repositories";
const repo = new PostRepository(db);
const post = await repo.findBySlug("prometheus-k8s-remote-write");
```

## Dependencies

### Internal

- `../index.ts` — Drizzle `db` connection instance
- `../schema/` — table definitions and inferred types

### External

- `drizzle-orm` — query builder (`eq`, `like`, `sql`, etc.)

<!-- MANUAL: -->
