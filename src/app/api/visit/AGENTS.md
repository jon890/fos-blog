<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-20 | Updated: 2026-04-01 -->

# app/api/visit

## Purpose
API route for querying page view counts and visitor statistics.
방문 기록 자체는 `proxy.ts` 미들웨어에서 처리되므로 이 라우트는 **조회 전용**입니다.

## Key Files

| File | Description |
|------|-------------|
| `route.ts` | `GET` — 조회수 쿼리 (단일 페이지 / 복수 페이지 / 사이트 전체) |

## For AI Agents

### Working In This Directory
- 방문 기록은 **`proxy.ts` 미들웨어**가 담당 (`waitUntil`로 비동기 처리) — 이 라우트에서 기록하지 않음
- IP 주소는 SHA-256으로 해시 후 저장 — raw IP는 저장하지 않음
- `getRepositories().visit` 를 통해 `VisitRepository` 접근

### API Contract
```
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
- `@/infra/db/repositories` → `getRepositories().visit` → `VisitRepository`

### Callers
- `src/components/PostViewCount.tsx` — 개별 포스트 조회수 표시 (`?path=`)
- `src/components/VisitorCount.tsx` — 사이트 전체 방문자 수 표시 (`?total=true`)

<!-- MANUAL: -->
