<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# docker/mysql

## Purpose

MySQL 컨테이너 초기화 스크립트 디렉토리. Docker Compose 실행 시 컨테이너가 최초 생성될 때 자동으로 실행되어 데이터베이스 문자셋, 타임존, 사용자 권한을 설정한다.

## Key Files

| File | Description |
|------|-------------|
| `init.sql` | MySQL 초기화 SQL — utf8mb4 문자셋, KST(+09:00) 타임존, fos_user 권한 설정 |

## For AI Agents

### Working In This Directory

- `init.sql`은 컨테이너 **최초 생성 시에만** 실행된다 — 기존 컨테이너에는 영향 없음
- 스키마 변경은 이 파일이 아닌 `drizzle/` 마이그레이션으로 관리한다
- 문자셋(`utf8mb4`)과 타임존(`+09:00`) 설정은 변경하지 않는다

### Testing Requirements

변경 사항 적용은 컨테이너를 재생성해야 한다:
```bash
pnpm db:down && pnpm db:up
```

## Dependencies

### External
- Docker Compose (`docker-compose.yml`) — 이 디렉토리를 MySQL init volume으로 마운트

<!-- MANUAL: -->
