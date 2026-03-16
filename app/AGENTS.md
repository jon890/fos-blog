<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-03-17 -->

# app

## Purpose
Next.js App Router directory containing all pages, layouts, API routes, and metadata generation. Uses the Next.js 13+ App Router convention with Server Components by default, ISR for caching, and file-system-based routing.

## Key Files

| File | Description |
|------|-------------|
| `layout.tsx` | Root layout — wraps all pages with ThemeProvider, Header, footer, Google Fonts, AdSense script, and inline theme-flash-prevention script |
| `page.tsx` | Homepage — displays hero section, category grid (first 6), recent posts (6), and stats; ISR revalidate=60 |
| `loading.tsx` | Root-level loading skeleton shown during page transitions |
| `not-found.tsx` | Custom 404 page |
| `globals.css` | Global Tailwind CSS imports and base styles |
| `robots.ts` | Generates `robots.txt` dynamically via Next.js metadata API |
| `sitemap.ts` | Dynamic sitemap generation pulling all post paths from DB |
| `icon.tsx` | Programmatic favicon generation |
| `apple-icon.tsx` | Programmatic Apple touch icon generation |
| `opengraph-image.tsx` | Dynamic Open Graph image for social sharing |
| `ads.txt` | Google AdSense publisher verification file (static) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `api/` | API route handlers (search, sync) — see `api/AGENTS.md` |
| `posts/` | Individual post detail pages — see `posts/AGENTS.md` |
| `categories/` | All categories listing page — see `categories/AGENTS.md` |
| `category/` | Category detail with folder-tree navigation — see `category/AGENTS.md` |

## For AI Agents

### Working In This Directory
- All pages are **Server Components** by default — only add `"use client"` when truly necessary
- ISR is configured per-page via `export const revalidate = N` (seconds)
- `layout.tsx` injects a theme script **before** hydration to avoid flash — do not reorder or remove it
- Metadata (title, OG, Twitter cards) is defined in `layout.tsx` for the root; override per-page using `export const metadata` or `generateMetadata()`
- `NEXT_PUBLIC_SITE_URL` env var controls canonical URL and OG urls — always use it instead of hardcoding

### Testing Requirements
- Run `pnpm build` to verify no build errors after page changes
- Check ISR behavior: changes take up to `revalidate` seconds to reflect without a manual revalidation

### Common Patterns
```ts
// ISR — revalidate every 60 seconds
export const revalidate = 60;

// Dynamic metadata
export async function generateMetadata({ params }) { ... }

// Static params for dynamic routes
export async function generateStaticParams() { ... }
```

## Dependencies

### Internal
- `@/components/` — UI components (Header, PostCard, CategoryList, etc.)
- `@/lib/db-queries` — legacy query wrapper (still used in `page.tsx`)
- `@/db/queries` — preferred Drizzle query class

### External
- `next/font/google` — Inter font loading
- `next-themes` — theme management via ThemeProvider
- `lucide-react` — icons

<!-- MANUAL: -->
