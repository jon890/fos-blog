<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-03-20 -->

# lib

## Purpose
Shared utility functions and service clients. Contains the GitHub API integration, markdown processing helpers, and the GitHub→DB sync orchestration. Pure TypeScript modules with no React dependencies.

## Key Files

| File | Description |
|------|-------------|
| `github.ts` | Octokit-based GitHub REST API client — fetches repo tree, file contents, folder structures, and derives category/post metadata; also exports `getCategoryIcon()` and `getCategoryColorClass()` |
| `markdown.ts` | Markdown utilities — `parseFrontMatter()`, `extractTitle()`, `extractDescription()`, `getReadingTime()`, `generateTableOfContents()` (uses `github-slugger` for slug parity with `rehype-slug`) |
| `sync-github.ts` | Sync orchestration — commit-based incremental sync (compares HEAD SHA to last synced commit); falls back to full sync when >300 files changed or on first run; also updates categories and folder READMEs |

## For AI Agents

### Working In This Directory
- `github.ts` requires `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` environment variables
- `github.ts` is a **dual-purpose** file: it serves both as a GitHub API client AND contains legacy direct-fetch helpers (`getPost`, `getCategories`) that were used before the DB layer existed — prefer the DB layer for production reads
- `sync-github.ts` writes to the database — do not call it directly from page rendering paths
- `generateTableOfContents()` in `markdown.ts` uses `github-slugger` to produce slugs identical to `rehype-slug` — keep them in sync if changing heading ID logic
- All functions are side-effect-free except `sync-github.ts`

### Key Exports from `github.ts`
```ts
// GitHub API
getDirectoryContents(path)       // List directory contents
getFileContent(path)             // Fetch raw file as string
getAllMarkdownFiles(path, files)  // Recursive markdown file discovery
getFolderContents(folderPath)    // { folders, posts, readme }

// Category/post helpers
getCategories()                  // All top-level categories with counts
getCategoryIcon(category)        // emoji icon string
getCategoryColorClass(category)  // Tailwind CSS class name
```

### Key Exports from `markdown.ts`
```ts
parseFrontMatter(content)        // { frontMatter, content } — strips YAML header
extractTitle(content)            // from frontmatter or first h1
extractDescription(content, max) // from frontmatter or first paragraph
getReadingTime(content)          // estimated minutes (200 wpm)
generateTableOfContents(content) // TocItem[] with level, text, slug
```

### Testing Requirements
- GitHub API calls require a valid token; mock Octokit for unit tests
- Sync tests need a running MySQL instance or transaction rollback

## Dependencies

### Internal
- `@/db/` — Drizzle ORM connection and schema (used by `sync-github.ts`)

### External
- `@octokit/rest` — GitHub REST API client
- `github-slugger` — heading slug generation (matches `rehype-slug` output)

<!-- MANUAL: -->
