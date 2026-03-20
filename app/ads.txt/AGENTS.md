<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-20 | Updated: 2026-03-20 -->

# app/ads.txt

## Purpose
Dynamically serves the Google AdSense `ads.txt` verification file via a Next.js route handler. Required for Google AdSense publisher verification.

## Key Files

| File | Description |
|------|-------------|
| `route.ts` | `GET /ads.txt` — returns plain text AdSense publisher declaration; reads `NEXT_PUBLIC_GOOGLE_ADSENSE_ID` env var |

## For AI Agents

### Working In This Directory
- If `NEXT_PUBLIC_GOOGLE_ADSENSE_ID` is not set, returns a comment placeholder (still `200`)
- Output format: `google.com, pub-<ID>, DIRECT, f08c47fec0942fa0`
- Cached for 24 hours (`Cache-Control: public, max-age=86400`)
- Do **not** convert this to a static file — the env var approach allows deployment-time configuration without rebuilds

## Dependencies

### External
- `NEXT_PUBLIC_GOOGLE_ADSENSE_ID` env var — Google AdSense publisher ID (format: `ca-pub-XXXXXXXXXXXXXXXX`)

<!-- MANUAL: -->
