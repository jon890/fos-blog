# Data Schema — 스키마 레퍼런스

**관련:** [prd.md](./prd.md) · [adr.md](./adr.md)

---

## 전체 스키마

7개 테이블. 스키마 소스: `src/infra/db/schema/*.ts`.

### `posts`

스키마 파일: `src/infra/db/schema/posts.ts`

용도: GitHub fos-study 리포에서 sync 된 마크다운 글 메타데이터 + 본문.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | int | PK, autoincrement | |
| `title` | varchar(500) | NOT NULL | |
| `path` | varchar(500) | NOT NULL, UNIQUE | canonical GitHub 파일 경로 (고유 키) |
| `slug` | varchar(500) | NOT NULL | URL slug |
| `category` | varchar(255) | NOT NULL | 최상위 카테고리명 |
| `subcategory` | varchar(255) | | 서브카테고리명 |
| `folders` | json | DEFAULT '[]' | n-depth 폴더 경로 배열 |
| `tags` | json | NOT NULL DEFAULT '[]' | frontmatter tags (plan026, ADR-023) |
| `content` | text | | 마크다운 원문 |
| `description` | text | | 발췌 설명 |
| `sha` | varchar(64) | | GitHub file SHA (변경 감지용) |
| `is_active` | boolean | NOT NULL DEFAULT true | soft delete 플래그 |
| `created_at` | timestamp | NOT NULL DEFAULT NOW | |
| `updated_at` | timestamp | NOT NULL DEFAULT NOW ON UPDATE | |

인덱스:
- `category_idx` on `(category)`
- `slug_idx` on `(slug)`
- `posts_updated_at_id_idx` on `(updated_at DESC, id DESC)` — 최신글 cursor 페이징 (ADR-002)

Notes:
- `path` = unique key (slug 이 아닌 path 기준 업서트)
- `is_active = false` = soft delete — 모든 조회에 `WHERE is_active = 1` 필수

---

### `visit_stats`

스키마 파일: `src/infra/db/schema/visitStats.ts`

용도: 글/페이지별 방문 수 집계 (일별 중복 제거 후 누적).

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | int | PK, autoincrement | |
| `page_path` | varchar(500) | NOT NULL, UNIQUE | |
| `visit_count` | int | NOT NULL DEFAULT 0 | |
| `updated_at` | timestamp | DEFAULT NOW ON UPDATE | |

인덱스:
- `visit_stats_page_path_idx` on `(page_path)` UNIQUE
- `visit_stats_count_path_idx` on `(visit_count DESC, page_path ASC)` — 인기글 offset 페이징 + 동점 안정화 (ADR-002)

---

### `visit_logs`

스키마 파일: `src/infra/db/schema/visitLogs.ts`

용도: 하루 단위 중복 방문 판별용 raw 로그. IP 주소는 SHA-256 해시로만 저장.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | int | PK, autoincrement | |
| `page_path` | varchar(500) | NOT NULL | |
| `ip_hash` | varchar(64) | NOT NULL | SHA-256 해시 (원본 IP 복원 불가) |
| `visited_date` | date | NOT NULL | 날짜 단위 중복 키 |
| `created_at` | timestamp | DEFAULT NOW | |

인덱스:
- `visit_page_ip_date_idx` on `(page_path, ip_hash, visited_date)` — 하루 1회 카운트 중복 방지 쿼리

Notes:
- `(page_path, ip_hash, visited_date)` 조합이 이미 존재하면 `visit_stats.visit_count` 를 증가하지 않음

---

### `folders`

스키마 파일: `src/infra/db/schema/folders.ts`

용도: GitHub 리포 폴더 트리. 카테고리 진입 시 README.md 본문 표시용.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | int | PK, autoincrement | |
| `path` | varchar(500) | NOT NULL, UNIQUE | GitHub 폴더 경로 |
| `readme` | text | | README.md 원문 |
| `sha` | varchar(64) | | README file SHA (변경 감지용) |
| `created_at` | timestamp | DEFAULT NOW | |
| `updated_at` | timestamp | DEFAULT NOW ON UPDATE | |

인덱스:
- `path_idx` on `(path)`

---

### `categories`

스키마 파일: `src/infra/db/schema/categories.ts`

용도: 카테고리 표시명 / slug / 아이콘 / 글 수 집계 캐시.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | int | PK, autoincrement | |
| `name` | varchar(255) | NOT NULL, UNIQUE | 표시명 |
| `slug` | varchar(255) | NOT NULL, UNIQUE | URL slug |
| `icon` | varchar(50) | | 아이콘 식별자 |
| `post_count` | int | NOT NULL DEFAULT 0 | 글 수 집계 캐시 |
| `created_at` | timestamp | DEFAULT NOW | |
| `updated_at` | timestamp | DEFAULT NOW ON UPDATE | |

인덱스:
- `slug_idx` on `(slug)`

---

### `comments`

스키마 파일: `src/infra/db/schema/comments.ts`

용도: 글별 댓글. 닉네임 공개 + 비밀번호 bcrypt 해시 저장 (ADR-021).

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | int | PK, autoincrement | |
| `post_slug` | varchar(500) | NOT NULL | 포스트 경로 (논리적 FK → `posts.path`) |
| `nickname` | varchar(100) | NOT NULL | 공개 표시명 |
| `password` | varchar(255) | NOT NULL | bcrypt 해시 (원본 복원 불가) |
| `content` | text | NOT NULL | `escapeHtml()` 단방향 escape 저장 (ADR-021) |
| `created_at` | timestamp | DEFAULT NOW | |
| `updated_at` | timestamp | DEFAULT NOW ON UPDATE | |

인덱스:
- `post_slug_idx` on `(post_slug)` — 글별 댓글 목록 조회

Notes:
- 물리적 FK 없음 (논리적 관계만) — sync 로 post 삭제 시 댓글은 보존
- `content` 는 저장 시 1회 `escapeHtml()` 적용, read 시 unescape 없음 (React JSX 가 자동 escape)

---

### `sync_logs`

스키마 파일: `src/infra/db/schema/syncLogs.ts`

용도: `/api/sync` 실행 이력 기록. 성공/실패 + 처리 건수 + HEAD commit SHA.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | int | PK, autoincrement | |
| `status` | varchar(50) | NOT NULL | `'success'` \| `'failed'` |
| `posts_added` | int | DEFAULT 0 | |
| `posts_updated` | int | DEFAULT 0 | |
| `posts_deleted` | int | DEFAULT 0 | |
| `commit_sha` | varchar(64) | | sync 된 HEAD commit SHA |
| `error` | text | | 실패 시 에러 메시지 |
| `synced_at` | timestamp | DEFAULT NOW | |

Notes:
- 인덱스 없음 (append-only, 최근 N건 조회만 사용)

---

## 인덱스 결정 (plan014 ADR-002)

`posts` cursor 페이징 + `visit_stats` offset 페이징을 위한 복합 인덱스 — 상단 각 테이블 섹션에 포함.

Drizzle 0.45.1 에서 column-level `.desc()` index chain 의 SQL 방향 직렬화가 불안정 → `sql\`${col} DESC\`` 템플릿 채택 (실측 확인 필요시 migration SQL 참조).

---

## Repository 메서드 요약

구현 상세는 `code-architecture.md` 참조. 주요 시그니처:

- `PostRepository.getRecentPostsCursor({ limit, cursor? })` — cursor `(updatedAt, id)` 기반 최신글
- `VisitRepository.getPopularPostPathsOffset({ limit, offset })` — offset 기반 인기글
- `PostRepository.getPostsByTag(tag, { limit })` — `JSON_CONTAINS` 쿼리 (ADR-023)
