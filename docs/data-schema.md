# Data Schema — 스키마 레퍼런스

**관련:** [prd.md](./prd.md) · [adr/README.md](./adr/README.md)

---

## 전체 스키마

현재 9개 테이블이다.
스키마 소스는 `src/infra/db/schema/*.ts`다.

### `posts`

스키마 파일: `src/infra/db/schema/posts.ts`

용도: GitHub fos-study 리포에서 sync 된 마크다운 글 메타데이터 + 본문.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | int | PK, autoincrement | |
| `title` | varchar(500) | NOT NULL | |
| `path` | varchar(500) | NOT NULL, UNIQUE | canonical GitHub 파일 경로 (고유 키) |
| `slug` | varchar(500) | NOT NULL | URL slug |
| `category` | varchar(255) | NOT NULL | 최상위(primary) 카테고리명 — 경로 첫 폴더. 정렬·하위호환용 단일 값 유지 |
| `categories` | json | NOT NULL DEFAULT '[]' | 다중 카테고리 합집합 `[경로 category, ...frontmatter categories]` 중복 제거. frontmatter 값은 `AI/RAG` 같은 하위 폴더 경로도 허용 (plan051, plan053, ADR-030) |
| `subcategory` | varchar(255) | | 서브카테고리명 (경로 둘째 폴더, 계층 개념 — 다중 소속과 무관) |
| `folders` | json | DEFAULT '[]' | n-depth 폴더 경로 배열 |
| `tags` | json | NOT NULL DEFAULT '[]' | frontmatter tags (plan026, ADR-023) |
| `series` | varchar(255) | NULL | frontmatter series 이름 (plan033, ADR-025) |
| `series_order` | int | NULL | frontmatter seriesOrder. series 있는데 seriesOrder 누락 시 둘 다 NULL + log.warn drop (plan033, ADR-025) |
| `thumbnail_url` | varchar(2048) | NULL | frontmatter `thumbnail` 상대 경로를 동기화 시점에 변환한 GitHub raw 절대 URL. 누락·무효 값은 NULL (plan056, ADR-033) |
| `content` | text | | 마크다운 원문 |
| `description` | text | | 발췌 설명 |
| `sha` | varchar(64) | | GitHub file SHA (변경 감지용) |
| `is_active` | boolean | NOT NULL DEFAULT true | soft delete 플래그 |
| `created_at` | timestamp | NOT NULL DEFAULT NOW | |
| `updated_at` | timestamp | NOT NULL DEFAULT NOW ON UPDATE | |

인덱스:
- `category_idx` on `(category)`
- `slug_idx` on `(slug)`
- `series_idx` on `(series)` — 시리즈 글 조회 (plan033, ADR-025)
- `posts_updated_at_id_idx` on `(updated_at DESC, id DESC)` — 최신글 cursor 페이징 (ADR-002)

Notes:
- `path` = unique key (slug 이 아닌 path 기준 업서트)
- `is_active = false` = soft delete — 모든 조회에 `WHERE is_active = 1` 필수
- 카테고리 페이지는 폴더 직속 글(경로 매칭)에 더해 cross-post 글을 `JSON_CONTAINS(categories, JSON_QUOTE(folderPath))` + 현재 폴더 경로 prefix 제외로 합쳐 노출한다 (plan051, plan053, ADR-030).
  `folderPath`는 `AI`뿐 아니라 `AI/RAG` 같은 하위 폴더 경로도 가능하다.
  폴더 브라우저(`path` prefix 매칭)는 그대로 유지한다.
  글 수가 적어 인덱스 없이 풀스캔을 허용한다.

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

### `glossary_terms` (plan054)

스키마 파일: `src/infra/db/schema/glossaryTerms.ts`

용도: `fos-study/glossary.json`에서 동기화한 용어 정의.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | varchar(128) | PK | 안정적인 URL 앵커와 용어 식별자 |
| `term` | varchar(255) | NOT NULL, UNIQUE | 대표 용어 |
| `full_name` | varchar(500) | | 약어의 전체 이름 |
| `aliases` | json | NOT NULL DEFAULT '[]' | 같은 개념으로 매칭할 별칭 |
| `summary` | text | NOT NULL | 툴팁용 짧은 설명 |
| `description` | text | NOT NULL | `/glossary`용 Markdown 설명 |
| `case_sensitive` | boolean | NOT NULL DEFAULT false | 영문 매칭의 대소문자 구분 여부 |
| `references` | json | NOT NULL DEFAULT '[]' | 검증된 외부 참고 링크 |
| `created_at` | timestamp | DEFAULT NOW | |
| `updated_at` | timestamp | DEFAULT NOW ON UPDATE | |

Notes:

- `id`, 대표 용어, 모든 별칭은 파일 전체에서 중복될 수 없다.
- 원본 누락이나 검증 실패 시 기존 row를 보존한다.
- 유효한 `terms: []`만 전체 삭제 의사로 해석한다.

---

### `glossary_mentions` (plan054)

스키마 파일: `src/infra/db/schema/glossaryMentions.ts`

용도: 용어가 등장한 글과 카테고리 README의 역참조.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | int | PK, autoincrement | |
| `term_id` | varchar(128) | NOT NULL, FK → `glossary_terms.id` | 용어 식별자 |
| `page_type` | varchar(32) | NOT NULL | `post` 또는 `category-readme` |
| `page_path` | varchar(500) | NOT NULL | 글 또는 폴더의 canonical 경로 |
| `page_title` | varchar(500) | NOT NULL | 목록 표시용 제목 snapshot |
| `page_updated_at` | timestamp | | 최근 수정 순 정렬 기준 |
| `created_at` | timestamp | DEFAULT NOW | |

인덱스와 제약:

- UNIQUE `(term_id, page_type, page_path)` — 한 페이지는 용어별 한 번만 저장한다.
- INDEX `(term_id, page_updated_at)` — 용어별 최근 언급 페이지를 조회한다.

Notes:

- 용어 정의가 변경되면 모든 역참조를 재계산한다.
- 글이나 README만 변경되면 해당 페이지의 역참조만 교체한다.
- 페이지 URL은 `page_type`과 `page_path`로 조회 시점에 생성한다.

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
