<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-01 | Updated: 2026-04-01 -->

# infra

## Purpose

외부 시스템 통합 레이어 (Infrastructure). 데이터베이스(Drizzle ORM + MySQL)와 GitHub API(Octokit) 클라이언트를 포함한다. 비즈니스 로직(`src/services/`)과 분리되어 있으며, 교체 가능한 구조로 설계되었다.

## Subdirectories

| Directory | Purpose                                                            |
| --------- | ------------------------------------------------------------------ |
| `db/`     | Drizzle ORM 연결, 스키마, 레포지토리 (see `db/AGENTS.md`)          |
| `github/` | Octokit GitHub API 클라이언트 및 유틸리티 (see `github/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- `db/`와 `github/`는 서로 독립적이다 — 교차 의존하지 않는다
- 이 레이어에는 비즈니스 로직을 넣지 않는다. 순수 데이터 접근/API 호출만 담당한다
- 환경변수 의존: `DATABASE_URL`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`
