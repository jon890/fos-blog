<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-04-01 -->

# local

## Purpose

로컬 개발 환경 설정. MySQL 8.4 컨테이너를 Docker Compose로 실행하는 설정과 초기화 스크립트를 포함한다.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `mysql/` | MySQL 초기화 SQL 스크립트 (see `mysql/AGENTS.md`) |

## Key Files

| File | Description |
|------|-------------|
| `docker-compose.yml` | MySQL 8.4 컨테이너 설정 — 포트 13307, 볼륨 마운트, health check |
| `mysql/init.sql` | 최초 컨테이너 시작 시 실행되는 초기화 SQL — DB, 사용자, 권한 설정 |
| `crontab.example` | 콘텐츠 동기화 cron 예시 — 매 시간 `/api/sync` 호출, `crontab` 명령으로 설치 |

## For AI Agents

### Working In This Directory

- `init.sql`은 **볼륨이 비어있을 때만** 실행된다 — 변경 시 `pnpm db:down && docker volume prune` 필요
- 스키마의 canonical source는 `src/infra/db/schema/` (Drizzle) — `init.sql`은 초기 구조만 반영
- 개발 중 스키마 변경은 `pnpm db:push`로 적용한다 (`init.sql` 수정보다 권장)

### Common Patterns

```bash
# MySQL 컨테이너 시작
pnpm db:up

# 컨테이너 중지 (데이터 유지)
pnpm db:down

# 데이터 초기화 (init.sql부터 재시작)
docker compose -f local/docker-compose.yml down -v && pnpm db:up
```

## Dependencies

### External
- Docker와 Docker Compose가 로컬에 설치되어 있어야 한다

<!-- MANUAL: -->
