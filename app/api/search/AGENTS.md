<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-03-17 -->

# app/api/search

## Purpose
GET API endpoint for full-text post search. Accepts a query string and returns matching posts. Called by `SearchDialog.tsx` on the frontend.

## Key Files

| File | Description |
|------|-------------|
| `route.ts` | `GET /api/search?q=<query>&limit=<n>` — delegates to `searchPosts()` in `lib/db-queries` |

## For AI Agents

### Working In This Directory
- Query param `q` is required; empty query returns `{ results: [] }` immediately
- `limit` defaults to 20
- Search is powered by MySQL `FULLTEXT` index with boolean mode (`+word*` syntax), falling back to `LIKE` on error
- This route has **no authentication** — it is public read-only

### API Contract
```
GET /api/search?q=react&limit=10

Response 200:
{ "results": [{ title, path, slug, category, subcategory, folders, description }] }

Response 500:
{ "results": [], "error": "Search failed" }
```

## Dependencies

### Internal
- `@/lib/db-queries` → `searchPosts(query, limit)`

<!-- MANUAL: -->
