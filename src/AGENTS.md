<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-01 | Updated: 2026-04-01 -->

# src

## Purpose

전체 애플리케이션 소스 코드. Next.js App Router 기반으로 계층화된 아키텍처를 따른다.

## Subdirectories

| Directory     | Purpose                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| `app/`        | Next.js 라우팅 — 페이지, API 라우트, 레이아웃 (see `app/AGENTS.md`)      |
| `components/` | 재사용 가능한 React UI 컴포넌트 (see `components/AGENTS.md`)             |
| `services/`   | 비즈니스 로직 레이어 — 동기화, 포스트 조회 (see `services/AGENTS.md`)    |
| `infra/`      | 외부 시스템 통합 — DB, GitHub API (see `infra/AGENTS.md`)                |
| `lib/`        | 공유 유틸리티 — markdown, logger, path-utils (see `lib/AGENTS.md`)       |
| `middleware/` | 미들웨어 책임별 모듈 — `visit.ts` (방문 기록), `rateLimit.ts` (예정)     |

## Key Files

| File       | Description                                                                              |
| ---------- | ---------------------------------------------------------------------------------------- |
| `proxy.ts` | Next.js 16 proxy file convention (구 `middleware.ts`) — `middleware/*` 조합. Node runtime 고정, `runtime` config 사용 불가 |

## Architecture

```
app/ (라우팅)
  ↓
services/ (비즈니스 로직)
  ↓
infra/ (외부 통합: DB, GitHub)
  ↑
lib/ (공유 유틸: 모든 레이어에서 사용)
```

## For AI Agents

- 각 레이어는 단방향으로만 의존한다: `app → services → infra`, `lib`은 모든 레이어에서 사용 가능
- `app/` 에서 `infra/`를 직접 import하지 않는다 — `services/`를 거쳐야 한다
- 새 기능 추가 시 레이어 경계를 지킨다
