<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-01 | Updated: 2026-04-01 -->

# services

## Purpose

비즈니스 로직 레이어. GitHub 동기화 오케스트레이션과 포스트 조회 로직을 담당한다. `src/infra/` (DB, GitHub API)에 의존하며, `src/app/api/` 라우트에서 호출된다. 순수 TypeScript 클래스로 단위 테스트 가능하도록 설계되어 있다.

## Key Files

| File | Description |
|------|-------------|
| `SyncService.ts` | 동기화 오케스트레이션 — `PostSyncService`와 `MetadataSyncService`를 조율하여 전체 동기화 흐름을 실행 |
| `PostSyncService.ts` | GitHub → DB 포스트 동기화 — 파일 추가/수정/삭제 처리, SHA 기반 증분 동기화 |
| `PostSyncService.test.ts` | PostSyncService 단위 테스트 |
| `MetadataSyncService.ts` | 메타데이터 동기화 — 기존 포스트의 제목, 설명, 카테고리 갱신 |
| `MetadataSyncService.test.ts` | MetadataSyncService 단위 테스트 |
| `PostService.ts` | 포스트 조회/필터링 비즈니스 로직 — 카테고리별, 슬러그별 조회 |
| `PostService.test.ts` | PostService 단위 테스트 |
| `index.ts` | 모든 서비스 export |

## For AI Agents

### Working In This Directory

- 서비스 클래스는 생성자에서 repository 인스턴스를 주입받는다 — DI 패턴 유지
- `SyncService`는 `POST /api/sync`에서만 호출한다. 페이지 렌더링 경로에서 직접 호출하지 않는다
- 에러는 `log.error({ err: error instanceof Error ? error : new Error(String(error)) }, ...)` 패턴으로 기록한다
- 새 서비스 추가 시 `index.ts`에 export 추가 필요

### Testing Requirements

- 단위 테스트는 Vitest 사용, repository는 vi.mock()으로 모킹한다
- 테스트 파일은 소스 파일과 동일 디렉토리에 co-locate (`*.test.ts`)
- `pnpm test` 또는 `pnpm test -- src/services/<파일명>`

### Common Patterns

```ts
// 서비스 인스턴스화 (API route에서)
import { SyncService } from "@/services";
const syncService = new SyncService(postRepo, syncLogRepo);
const result = await syncService.sync();
```

## Dependencies

### Internal
- `@/infra/db/repositories/` — 데이터 접근 (PostRepository, SyncLogRepository 등)
- `@/infra/github/` — GitHub API 클라이언트
- `@/lib/` — markdown, logger, path-utils

### External
- `pino` — 구조화 로깅 (`logger.child({ module: 'SyncService' })`)
