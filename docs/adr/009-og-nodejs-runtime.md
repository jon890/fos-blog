## ADR-009. `ImageResponse` 런타임 — Node.js 명시

**Context**: `next/og` 기본 Edge runtime. 홈서버 standalone 우선.

**Decision**: 모든 `opengraph-image.tsx` 와 OG `route.tsx` 에 `export const runtime = "nodejs"`.

**Why**: 홈서버 standalone 안정성 + `fs.readFile` 등 Node API 자유 사용 + ISR 60초가 부팅 비용 흡수. Edge runtime 은 `fs` 미지원 → 폰트/로고 embedding 복잡, 기각.
