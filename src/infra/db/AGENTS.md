<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-04-01 -->

# infra/db

## Purpose

Drizzle ORM 기반 데이터베이스 레이어. MySQL 연결, 스키마 정의, 레포지토리 패턴(Repository Pattern)으로 구성된다. 모든 DB 접근은 이 레이어를 통해서만 이루어진다.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Drizzle 연결 싱글턴 — `db` 인스턴스 export |
| `types.ts` | 애플리케이션 레벨 TypeScript 타입 (`PostData`, `CategoryData` 등) |
| `constants.ts` | DB 상수 (카테고리 아이콘 맵 등) |
| `constants.test.ts` | 상수 테스트 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `schema/` | Drizzle 테이블 정의 — 엔티티당 1개 파일 (see `schema/AGENTS.md`) |
| `repositories/` | Repository 클래스 — 엔티티별 데이터 접근 (see `repositories/AGENTS.md`) |

## Schema Overview

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `posts` | id, title, path (unique), slug, category, subcategory, folders (JSON), content, description, sha, isActive | GitHub에서 동기화된 마크다운 포스트 |
| `categories` | id, name (unique), slug (unique), icon, postCount | GitHub 디렉토리 구조 기반 카테고리 |
| `folders` | id, path (unique), readme, sha | 선택적 README가 있는 디렉토리 노드 |
| `syncLogs` | id, status, postsAdded, postsUpdated, postsDeleted, error, syncedAt | GitHub 동기화 이력 |
| `comments` | id, postId, author, email, content, createdAt | 포스트별 댓글 |
| `visitStats` | id, postId, viewCount, updatedAt | 포스트 조회수 집계 |
| `visitLogs` | id, postId, createdAt | 방문자별 조회 로그 |

## For AI Agents

### Working In This Directory

- `posts.path`가 canonical 식별자 (예: `ai/intro.md`) — `slug`가 아님
- `posts.sha`는 GitHub blob SHA로 증분 동기화에 사용됨 — 이유 없이 초기화하지 않는다
- `posts.isActive`로 soft delete — 쿼리 시 항상 `eq(posts.isActive, true)` 필터 포함
- `posts.folders`는 JSON 배열 (경로 세그먼트) — 브레드크럼에 사용
- 검색은 MySQL `FULLTEXT` 인덱스 사용 (`title`, `content`, `description`)
- 스키마 변경 시: `pnpm db:generate` → `pnpm db:push` (또는 `pnpm db:migrate`)

### Testing Requirements

- `pnpm db:up`으로 MySQL 컨테이너 시작 필요
- `pnpm db:studio`로 데이터 시각적 확인 가능

### Common Patterns

```ts
import { db } from "@/infra/db";
import { PostRepository } from "@/infra/db/repositories";

const postRepo = new PostRepository(db);
const posts = await postRepo.findByCategory("ai");
const post = await postRepo.findBySlug("ai/intro");
```

## Dependencies

### Internal
- `src/services/`에서 repository 인스턴스를 주입받아 사용

### External
- `drizzle-orm` — ORM 및 쿼리 빌더
- `mysql2` — MySQL 드라이버

<!-- MANUAL: -->
