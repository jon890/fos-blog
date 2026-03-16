<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-03-17 -->

# app/category/[...path]

## Purpose
Folder/category detail page. Renders the contents of any GitHub directory node: its README (if present), sub-folders as clickable cards, and direct posts as `PostCard` components. Supports arbitrary nesting depth via the catch-all `[...path]` segment.

## Key Files

| File | Description |
|------|-------------|
| `page.tsx` | Server Component — resolves path, fetches folder contents, renders README + subfolders + posts |
| `loading.tsx` | Loading skeleton shown while page data is fetching |

## For AI Agents

### Working In This Directory
- `params.path` is `string[]` (e.g. `["ai", "basics"]`) — join with `/` for the DB `folderPath` key
- Always `decodeURIComponent` each segment from params; always `encodeURIComponent` when building link hrefs
- Returns 404 (`notFound()`) if no folders, posts, or readme exist for the path
- Breadcrumb is built by mapping path segments to partial paths
- The page icon comes from `getCategoryIcon(pathSegments[0])` — the top-level category name
- `generateStaticParams()` pre-generates all known folder paths at build time for ISR

### Data Flow
```
params.path (string[])
  → decodeURIComponent each segment
  → folderPath = segments.join("/")
  → getFolderContents(folderPath) → { folders, posts, readme }
  → render README | subfolder cards | PostCard list
```

## Dependencies

### Internal
- `@/lib/db-queries` → `getFolderContents()`, `getAllFolderPaths()`, `getCategoryIcon()`
- `@/components/PostCard`
- `@/components/MarkdownRenderer` (for README rendering)

<!-- MANUAL: -->
