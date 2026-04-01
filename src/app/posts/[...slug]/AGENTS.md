<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-03-20 -->

# app/posts/[...slug]

## Purpose
Individual post detail page. Renders a full markdown post with: article header (category badge, title, reading time, GitHub link), markdown body, sidebar Table of Contents, and structured data (JSON-LD for Article and Breadcrumb schemas).

## Key Files

| File | Description |
|------|-------------|
| `page.tsx` | Server Component — fetches post by path, parses markdown, renders full article layout |
| `loading.tsx` | Loading skeleton displayed while post data loads |

## For AI Agents

### Working In This Directory
- `params.slug` is `string[]` — join with `/` after `decodeURIComponent` to get the DB `post.path`
- Content pipeline: `getPost(slug)` → `parseFrontMatter()` (strips YAML front matter) → `extractTitle()` / `extractDescription()` / `generateTableOfContents()` → `MarkdownRenderer`
- `generateStaticParams()` pre-generates all active post paths at build time
- The sidebar TOC (`TableOfContents`) only renders when `toc.length > 0`; it's hidden on mobile (`hidden lg:block`)
- GitHub edit link is constructed as `https://github.com/jon890/fos-study/blob/main/${post.path}`
- Breadcrumb includes home → category → optional subcategory → post title

### Data Flow
```
params.slug (string[])
  → slug = decodeURIComponent each → join("/")
  → getPost(slug) → { content (raw markdown), post (metadata) }
  → parseFrontMatter(content) → mainContent (without YAML header)
  → extractTitle / extractDescription / getReadingTime / generateTableOfContents
  → <MarkdownRenderer content={mainContent} />
  → <TableOfContents toc={toc} /> (sidebar)
```

### SEO
- `generateMetadata()` sets title and OG description from post content
- `ArticleJsonLd` and `BreadcrumbJsonLd` are injected for structured data

## Dependencies

### Internal
- `@/services/PostService` → `getPost()`, `getCategoryIcon()`, `getAllPostPaths()`
- `@/lib/markdown` → `extractTitle()`, `extractDescription()`, `getReadingTime()`, `generateTableOfContents()`, `parseFrontMatter()`
- `@/components/MarkdownRenderer`
- `@/components/TableOfContents`
- `@/components/Comments` — client-side comment section rendered below post body
- `@/components/PostViewCount` — records and displays view count on page load
- `@/components/JsonLd` → `ArticleJsonLd`, `BreadcrumbJsonLd`

<!-- MANUAL: -->
