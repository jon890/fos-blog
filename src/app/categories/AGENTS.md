<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-03-17 -->

# app/categories

## Purpose
Static listing page for all post categories. Displays every category as a card grid. ISR revalidates every 60 seconds.

## Key Files

| File | Description |
|------|-------------|
| `page.tsx` | Server Component — fetches all categories, renders them via `CategoryList` |

## For AI Agents

### Working In This Directory
- Simple page — one data fetch (`getCategories()`), one component render (`CategoryList`)
- No dynamic params; all categories shown at once (no pagination)
- Metadata is statically defined (not `generateMetadata`)
- To add sorting or filtering, modify the `getCategories()` call or add client-side controls

## Dependencies

### Internal
- `@/db/queries` → `getDbQueries()` → `getCategories()`
- `@/components/CategoryList`

<!-- MANUAL: -->
