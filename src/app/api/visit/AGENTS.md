<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-20 | Updated: 2026-03-20 -->

# app/api/visit

## Purpose
API route for tracking and querying page view counts and visitor statistics. Records visits with IP deduplication (SHA-256 hashed) and provides flexible query modes for single/multiple pages and total counts.

## Key Files

| File | Description |
|------|-------------|
| `route.ts` | `POST` — record a visit; `GET` — query visit counts (single page, multiple pages, or site total) |

## For AI Agents

### Working In This Directory
- IP addresses are **SHA-256 hashed** before storage — raw IPs are never persisted
- IP is extracted from `x-visitor-ip` header (set by middleware), then `x-forwarded-for`, then `x-real-ip`
- `recordVisit()` returns `isNewVisit: boolean` — used by the client to avoid double-counting
- Uses `getDbQueries()` — returns `null` if DB unavailable → `503`

### API Contract
```
POST /api/visit
  Body: { pagePath: string }
  → 200: { success: true, isNewVisit: boolean }

GET /api/visit?path=<pagePath>
  → 200: { count: number }

GET /api/visit?paths=<path1,path2>
  → 200: { counts: Record<string, number> }

GET /api/visit?total=true
  → 200: { totalCount: number, todayCount: number }

GET /api/visit  (no params)
  → 200: { totalCount: number }
```

## Dependencies

### Internal
- `@/db/queries` → `getDbQueries()`, `recordVisit()`, `getVisitCount()`, `getPostVisitCounts()`, `getTotalVisitCount()`, `getTodayVisitorCount()`

<!-- MANUAL: -->
