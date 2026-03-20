<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-03-20 -->

# components

## Purpose
Reusable React UI components used across the application. All components are **Client or Server Components** — check each file for `"use client"` directive. Presentation logic only; data fetching happens in `app/` pages.

## Key Files

| File | Description |
|------|-------------|
| `Header.tsx` | Top navigation bar — site logo, search trigger button, theme toggle |
| `PostCard.tsx` | Card for post listings — displays title, category, description |
| `CategoryCard.tsx` | Card for a single category — icon, name, post count |
| `CategoryList.tsx` | Responsive grid of `CategoryCard` components |
| `MarkdownRenderer.tsx` | Converts markdown string → styled React output with syntax highlighting, GFM, raw HTML, and slug-based heading IDs |
| `TableOfContents.tsx` | Auto-generates a clickable TOC from post heading structure (uses rehype-slug IDs) |
| `SearchDialog.tsx` | Modal full-text search UI — calls `/api/search?q=` and displays results; requires `"use client"` |
| `ThemeProvider.tsx` | Wraps children with `next-themes` Provider; `enableSystem=false`, `defaultTheme="dark"` |
| `ThemeToggle.tsx` | Icon button toggling between dark/light mode |
| `Mermaid.tsx` | Client Component — renders Mermaid diagram charts using `mermaid` library; theme-aware (dark/light) |
| `Comments.tsx` | Client Component — per-post comment list and submission form; calls `/api/comments` |
| `PostViewCount.tsx` | Client Component — displays view count for a post fetched from `/api/visit` |
| `VisitorCount.tsx` | Client Component — displays total site visitor count |
| `JsonLd.tsx` | Generates JSON-LD structured data — exports `WebsiteJsonLd`, `ArticleJsonLd`, `BreadcrumbJsonLd` |

## For AI Agents

### Working In This Directory
- Keep components **pure presentational** — no direct DB calls or fetch inside components
- `SearchDialog.tsx` and `ThemeToggle.tsx` are Client Components (`"use client"`) — they interact with browser APIs
- `MarkdownRenderer.tsx` uses a plugin pipeline: `remark-gfm` → `rehype-slug` → `rehype-highlight` → `rehype-raw`; modify the plugin array carefully as order matters
- **Code block inline detection:** `isInline = !className && !String(children).includes("\n")` — fenced blocks without a language have no className, so newline check prevents them from being styled as inline code
- `Mermaid.tsx` renders via `dangerouslySetInnerHTML` with `mermaid.render()` — it re-renders on theme change
- `JsonLd.tsx` structured data affects SEO — update schema types only when the content type changes

### Testing Requirements
- Visual changes should be tested in both dark and light mode
- `SearchDialog` requires a running database and search API to function end-to-end

### Common Patterns
```tsx
// Client component pattern
"use client";
import { useState } from "react";

// Tailwind dark mode pattern
className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"

// JSON-LD usage in pages
<ArticleJsonLd title={post.title} url={...} datePublished={...} />
```

## Dependencies

### Internal
- Called from `app/layout.tsx`, `app/page.tsx`, and all route pages

### External
- `react-markdown` — markdown rendering
- `remark-gfm` — GitHub Flavored Markdown
- `rehype-highlight` — syntax highlighting
- `rehype-slug` — heading ID generation
- `rehype-raw` — raw HTML in markdown
- `next-themes` — theme management
- `lucide-react` — icons

<!-- MANUAL: -->
