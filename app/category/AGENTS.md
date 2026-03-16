<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-03-17 -->

# app/category

## Purpose
Dynamic folder/category navigation. The `[...path]` catch-all segment handles any depth of the GitHub directory tree — from top-level categories (e.g. `/category/ai`) down to deeply nested folders (e.g. `/category/ai/basics/intro`).

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `[...path]/` | Catch-all route for folder navigation at any depth — see `[...path]/AGENTS.md` |

## For AI Agents

### Working In This Directory
- The catch-all `[...path]` captures path segments as `params.path: string[]`
- URL path segments are URL-encoded; always `decodeURIComponent` before using as DB keys
- Navigation links must `encodeURIComponent` each segment when constructing hrefs

<!-- MANUAL: -->
