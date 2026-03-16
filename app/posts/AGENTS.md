<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-03-17 -->

# app/posts

## Purpose
Individual post detail pages. The `[...slug]` catch-all maps to the full GitHub file path of a post (e.g. `/posts/ai/intro` → DB path `ai/intro`).

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `[...slug]/` | Catch-all route for post detail pages — see `[...slug]/AGENTS.md` |

## For AI Agents

### Working In This Directory
- The slug segments correspond directly to `posts.path` in the database
- Always `decodeURIComponent` each slug segment before joining and querying the DB

<!-- MANUAL: -->
