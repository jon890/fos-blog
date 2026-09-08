# Data Schema: 스키마 레퍼런스

## 스키마 변경과 마이그레이션

스키마 단일 소스는 `src/infra/db/schema/`다.
DB 스키마를 바꿀 때는 다음 순서를 따른다.

1. 스키마 소스를 수정하고 `pnpm db:generate`로 `drizzle/` 산출물을 생성한다.
2. 생성 SQL과 metadata를 직접 편집하지 않고, 데이터 삭제와 파괴적 변경 여부를 검토한다.
3. 스키마와 생성된 마이그레이션을 같은 커밋에 포함한다.
4. 격리된 로컬 MySQL에서 `pnpm db:migrate` 또는 `pnpm db:migrate:runtime`으로 적용을 검증한다.

운영 DB에 `pnpm db:push`를 사용하지 않는다.
이 명령은 버려도 되는 로컬 실험에만 허용하며, 커밋 전에 마이그레이션으로 바꾸거나 실험 변경을 되돌린다.
[Dockerfile](../Dockerfile)은 컨테이너 시작 시 `migrate.js`가 성공한 뒤 `server.js`를 실행한다.
문서 승인이나 로컬 검증은 운영 DB 적용과 배포 승인을 대신하지 않는다.
[마이그레이션 실행기](../scripts/migrate.ts)는 DB 연결 재시도와 최종 연결 실패 로그의 DB URL 비밀번호를 가린다.
이를 모든 애플리케이션 로그에 적용되는 자동 마스킹으로 가정하지 않는다.

## 학습자료 저장 계약

**구현 범위:** 관리자 인증 테이블 네 개와 study 테이블 13개를 제공한다.
추천·가져오기 서비스는 후속 계획에서 이 스키마를 사용한다.
HTTP 필드의 길이와 입력 검증은 [학습자료 API](./api/study-library.md)가 소유한다.
기존 MySQL에 `study_` 테이블을 추가하고 `posts`, GitHub 동기화와 방문 통계는 연결하지 않는다.

### 타입과 소유자

ID는 `INT UNSIGNED AUTO_INCREMENT`, 버전과 순번은 `INT UNSIGNED`를 사용한다.
증가 전 범위를 검사하며 초과를 순환이나 0으로 처리하지 않는다.
시간은 UTC `DATETIME(3)`로 저장하고 API에서 UTC ISO 문자열로 변환한다.
아래 표에서 `?`는 nullable이고 나머지 필드는 NOT NULL이다.
길이 없는 키는 `VARCHAR(128)`, 해시는 `CHAR(64)`, URL은 `VARCHAR(2048)`다.
식별자와 해시는 binary 비교를 적용하고 제목과 검색용 텍스트는 `utf8mb4`로 저장한다.
같은 YouTube ID의 대소문자가 다른 경우 UNIQUE 제약에서도 구분해야 한다.

소유자는 서버에 고정한 논리 키 `owner` 하나이며 브라우저 입력으로 받지 않는다.
로그인 제공자의 고정 계정 ID는 이 소유자에 인증하는 설정값으로만 쓰므로 로그인 변경 시 자료를 이관하지 않는다.
다중 사용자, 공개 여부 컬럼과 공개 조회는 이번 저장 모델에 추가하지 않는다.
공통 관리자 로그인 뒤에 공부 화면을 제공하며 공개 자료 API는 이번 범위에 없다.
일반 공개 범위가 별도로 바뀌면 실행 전에 이 절을 재검토한다.
인증용 계정·세션 테이블은 study 테이블과 분리한다.
Better Auth 테이블은 아래 [관리자 인증 저장 계약](#관리자-인증-저장-계약)을 따른다.

### 테이블

| 테이블 | 필드 | 키와 제약 |
| --- | --- | --- |
| `study_sources` | `source_key`, `title VARCHAR(500)`, `category VARCHAR(16)`, `url?`, `feed_url?`, `adapter VARCHAR(16)`, `enabled BOOLEAN`, `version`, `updated_at` | PK source_key. API enum과 URL 조합 검증 적용 |
| `study_source_cursors` | `source_key`, `mode VARCHAR(8)`, `cursor JSON?`, `version`, `updated_at` | PK (source_key, mode), source FK. recent/archive 행을 소스 생성과 함께 version 0으로 생성 |
| `study_materials` | `id`, `content_key VARCHAR(191)`, `canonical_url`, `url`, `title VARCHAR(500)`, `published VARCHAR(128)`, `published_at?`, `excerpt TEXT?`, `kind VARCHAR(16)`, `collected_at`, `created_at` | PK id, UNIQUE content_key, INDEX (published_at, id). excerpt는 API 2000자 제한 |
| `study_material_sources` | `material_id`, `source_key`, `collected_at` | PK (material_id, source_key), 양쪽 FK, INDEX (source_key, material_id) |
| `study_material_tags` | `material_id`, `tag VARCHAR(50)` | PK (material_id, tag), material FK. API 배열을 관계로 저장 |
| `study_material_states` | `owner_key`, `material_id`, `starred BOOLEAN`, `read BOOLEAN`, `note TEXT`, `version`, `updated_at` | PK (owner_key, material_id), material FK. 최초 상태는 행 없이 API 기본값, 최초 수정 version 1 |
| `study_recommendation_control` | `owner_key`, `history_version`, `latest_run_id INT?` | PK owner_key. 초기 행 owner/0/null, 모든 추천·가져오기 commit의 잠금 대상 |
| `study_recommendation_runs` | `id`, `report_id`, `generated_at`, `committed_at`, `request_hash`, `history_version`, `origin VARCHAR(8)` | PK id, UNIQUE report_id. origin은 live/import, history_version은 해당 저장 영수증의 버전 |
| `study_recommendation_topics` | `id`, `run_id`, `position`, `topic_key`, `title VARCHAR(300)`, `career_question VARCHAR(300)?` | PK id, run FK, UNIQUE (run_id, topic_key), UNIQUE (run_id, position) |
| `study_recommendation_items` | `id`, `run_id`, `topic_id`, `position`, `material_id`, `title VARCHAR(500)`, `canonical_url`, `summary VARCHAR(300)?`, `reason VARCHAR(300)?`, `career_value VARCHAR(32)?` | PK id, run/topic/material FK, UNIQUE (run_id, material_id), UNIQUE (topic_id, position). topic의 run 일치 검증 |
| `study_recommended_materials` | `owner_key`, `material_id`, `first_run_id` | PK (owner_key, material_id), material/run FK. 과거 반복 추천과 별개인 누적 중복 판정 집합 |
| `study_publications` | `id`, `run_id`, `channel`, `published_at`, `external_id`, `url?`, `request_hash` | PK id, run FK, UNIQUE (run_id, channel, external_id) |
| `study_request_receipts` | `operation VARCHAR(16)`, `request_key`, `request_hash`, `response JSON`, `created_at` | PK (operation, request_key). operation은 ingestion/publication/import |

추천 항목의 title과 canonical_url은 추천 당시 값을 보존한다.
가져오기 자료의 url은 canonicalUrl이며 `collected_at`과 `created_at`은 서버 가져오기 시각이다.
이 시각을 원문 발행일로 사용하지 않는다.
기존 자료는 가져오기로 갱신하지 않고 소스 연결만 없는 경우 추가한다.
신규 수집은 API의 collectedAt 비교로 메타와 태그를 함께 갱신한다.
소스 연결의 collected_at은 그 소스의 가장 큰 수집 시각을 유지한다.
모든 추천 항목의 nullable 설명 필드는 과거 이력 보존을 위한 것이며 신규 추천 입력에서는 필수다.

### 원자성과 재시도

| 쓰기 | 같은 트랜잭션에서 처리할 범위 | 동시 요청과 실패 |
| --- | --- | --- |
| 소스 등록 | 소스 버전 비교, 소스와 최초 cursor 두 행 생성 | 생성 경합은 UNIQUE로 직렬화하고 오래된 version은 409 |
| 자료 수집 | 영수증 재조회, cursor 잠금·버전 비교, 자료·태그·소스 연결, cursor 증가, 영수증 | 동일 영수증 재전송은 버전 검사를 생략, 잠금 뒤에도 재조회. 자료 키 오름차순으로 처리 |
| 개인 상태 | (owner, material) 조건부 갱신 또는 최초 INSERT | 최초 생성 경합은 UNIQUE 위반을 409로 변환. 메모 자동 병합 없음 |
| 신규 추천 | control 잠금, reportId 재조회, 누적 중복·직전 주제 검사, run/topic/item/snapshot, 누적 집합, 최신 포인터·버전 | 동일 reportId 재시도는 원래 버전 반환. 빈 topics도 실행 이력과 최신 포인터를 갱신 |
| 게시 기록 | 영수증, 게시 고유 키 검증, publication 저장 | 같은 고유 키의 다른 본문은 409. 외부 발송은 하지 않음 |
| 이력 가져오기 | control 잠금, 영수증·미리보기 버전 검사, 새 자료·소스 연결·과거 이력·누적 집합·영수증 | 전체 rollback. 과거 반복 자료는 이력 행을 보존하고 누적 집합만 합침 |

각 잠금 재획득 뒤 멱등 키를 재조회한다. 영수증은 현재 계획에서 만료·삭제하지 않는다.
DB deadlock은 트랜잭션 전체를 rollback하고 최대 2회 재시도한 뒤 `503 UNAVAILABLE`로 반환한다.
오래된 버전과 검증 오류는 자동 재시도하지 않는다.
DB를 사용할 수 없으면 빈 개인 목록이나 성공 영수증으로 대체하지 않는다.

### 삭제와 마이그레이션

삭제 API와 보존기간 자동 삭제는 제공하지 않으며 FK는 모두 `RESTRICT`다.
소스 비활성화는 이미 수집한 자료와 개인 상태, 추천 이력을 보존한다.
운영자가 삭제할 필요가 생기면 별도 승인과 삭제 순서 설계가 필요하다.

구현 시 스키마 단일 소스 `src/infra/db/schema/study.ts`와 export를 먼저 작성한다.
[공통 마이그레이션 절차](#스키마-변경과-마이그레이션)에 따라 FK, 대소문자 UNIQUE, 재실행과 rollback을 검증한다.
기존 테이블의 데이터·인덱스 변경과 운영 DB 적용은 이 설계 작업에 포함하지 않는다.

**관련:** [prd.md](./prd.md) · [adr/README.md](./adr/README.md)

---

## 관리자 인증 저장 계약

`src/infra/db/schema/auth.ts`에 인증 테이블 네 개를 정의한다.
Better Auth의 `user`, `session`, `account`, `verification` 모델을 adapter의 schema 객체에 명시적으로 연결한다.
Drizzle 속성은 공식 camelCase 모델명을 유지하고 실제 SQL 컬럼은 snake_case로 매핑한다.
아래 모델 구성은 [Better Auth 공식 DB 계약](https://better-auth.com/docs/concepts/database)을 따른다.

| SQL 테이블 | 필드 | 키와 삭제 |
| --- | --- | --- |
| `auth_user` | `id`, `name`, `email`, `emailVerified`, `image?`, `createdAt`, `updatedAt` | PK id, UNIQUE email |
| `auth_session` | `id`, `userId`, `token`, `expiresAt`, `ipAddress?`, `userAgent?`, `createdAt`, `updatedAt` | PK id, UNIQUE token, userId INDEX와 FK CASCADE |
| `auth_account` | `id`, `userId`, `accountId`, `providerId`, `accessToken?`, `refreshToken?`, `idToken?`, `accessTokenExpiresAt?`, `refreshTokenExpiresAt?`, `scope?`, `password?`, `createdAt`, `updatedAt` | PK id, UNIQUE (providerId, accountId), userId INDEX와 FK CASCADE |
| `auth_verification` | `id`, `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt` | PK id, identifier INDEX |

`id`, `userId`, `accountId`, `providerId`, `token`, `identifier`, `email`, `name`은 `VARCHAR(255)`다.
image, userAgent, value, scope와 token·password 계열의 나머지 문자열은 `TEXT`다.
ipAddress는 `VARCHAR(45)`, emailVerified는 기본 false인 `BOOLEAN`, 모든 날짜는 UTC `DATETIME(3)`다.
`?` 필드만 nullable이다. 식별자와 session token은 binary 비교를 적용한다.
email은 권한 근거가 아니며 Better Auth 기본 모델 호환을 위해 저장한다.
실제 GitHub numeric ID는 `auth_account.accountId` 문자열로 저장하며 로컬 `auth_user.id`와 구분한다.
GitHub ID를 환경 설정에서 DB 사용자 PK로 복사하거나 숫자 자동 증가로 치환하지 않는다.

계정 삭제 기능은 노출하지 않는다. 향후 인증 사용자 행을 삭제하면 session과 account만 cascade한다.
study 소유자 `owner`에는 auth FK를 두지 않아 로그인 계정 설정 변경으로 자료를 지우지 않는다.
비밀번호 로그인은 꺼 두므로 password는 null이며 OAuth token은 필요한 인증 처리 외에 사용하거나 응답하지 않는다.
session 로그아웃은 해당 session 행 삭제로 철회한다. verification 만료와 소비는 Better Auth가 처리한다.
공통 DB parameter 로그를 끄고 인증 logger에도 토큰과 프로필 원문을 전달하지 않는다.
이 네 테이블에는 앞선 study 테이블의 `INT` ID와 FK `RESTRICT` 규칙을 적용하지 않는다.

기존 Drizzle 마이그레이션 체계로 생성·적용하며 Better Auth의 직접 DB migrate는 사용하지 않는다.
[공통 마이그레이션 절차](#스키마-변경과-마이그레이션)에 따라 재실행, FK와 세션 철회를 검증한다.
운영 DB 적용과 데이터 정리는 별도 승인 작업이다.

## 전체 스키마

현재 인증 테이블 네 개를 포함해 13개 테이블이다.
스키마 소스는 `src/infra/db/schema/*.ts`다.

### `posts`

스키마 파일: `src/infra/db/schema/posts.ts`

용도: GitHub fos-study 리포에서 sync 된 마크다운 글 메타데이터와 본문.

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
| `series_order` | int | NULL | frontmatter seriesOrder. series 있는데 seriesOrder 누락 시 둘 다 NULL 로 두고 log.warn 후 drop (plan033, ADR-025) |
| `thumbnail_url` | varchar(2048) | NULL | frontmatter `thumbnail` 상대 경로를 동기화 시점에 변환한 GitHub raw 절대 URL. 누락·무효 값은 NULL (plan056, ADR-033) |
| `content` | text | | 마크다운 원문 |
| `description` | text | | 발췌 설명. frontmatter `description`이 있으면 그 값, 없으면 본문 산문 블록에서 추출한 평문 200자. 마크다운 마커는 제거하고 링크가 있는 첫머리 인용문은 제외한다 (plan058, ADR-034) |
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
- 사용자에게 노출하는 글 조회는 `is_active = true`로 제한한다.
  동기화와 내부 존재 확인은 비활성 글도 조회한다.
- 카테고리 페이지는 폴더 직속 글(경로 매칭)에 더해 교차 게시 글을 노출한다.
  교차 게시 글은 `categories`와 `folderPath`를 소문자로 맞춘 `JSON_CONTAINS` 조건과 현재 폴더 경로 접두사 제외를 함께 적용해 찾는다 (plan051, plan053, plan059, ADR-030, ADR-035).
  `folderPath`는 `AI`뿐 아니라 `AI/RAG` 같은 하위 폴더 경로도 가능하다.
  폴더 브라우저(`path` 접두사 매칭)도 대소문자를 구분하지 않는다.
  글 수가 적어 인덱스 없이 풀스캔을 허용한다.

신규 글의 `created_at`은 [동기화 서비스](../src/services/PostSyncService.ts)가 조회한 GitHub 커밋 날짜를 우선한다.
[GitHub 조회](../src/infra/github/api.ts)는 최대 100개 커밋 중 가장 오래된 날짜를 사용하므로 전체 이력의 최초 날짜를 보장하지 않는다.
커밋 날짜를 얻지 못하면 DB 기본값으로 생성 시각을 저장한다.
기존 글 갱신은 `created_at`을 유지하며 `updated_at`을 갱신한다.

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
- `visit_stats_count_path_idx` on `(visit_count DESC, page_path ASC)` — 인기글 offset 페이징과 동점 안정화 (ADR-002)

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

용도: 글별 댓글. 닉네임 공개와 비밀번호 bcrypt 해시 저장 (ADR-021).

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
| `created_at` | timestamp | NOT NULL DEFAULT NOW | |
| `updated_at` | timestamp | NOT NULL DEFAULT NOW ON UPDATE | |

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
| `term_id` | varchar(128) | NOT NULL, FK → `glossary_terms.id` ON DELETE CASCADE | 용어 식별자 |
| `page_type` | varchar(32) | NOT NULL | `post` 또는 `category-readme` |
| `page_path` | varchar(500) | NOT NULL | 글 또는 폴더의 canonical 경로 |
| `page_title` | varchar(500) | NOT NULL | 목록 표시용 제목 snapshot |
| `page_updated_at` | timestamp | | 최근 수정 순 정렬 기준 |
| `created_at` | timestamp | NOT NULL DEFAULT NOW | |

인덱스와 제약:

- `glossary_mentions_term_page_unique` UNIQUE on `(term_id, page_type, page_path)` — 한 페이지는 용어별 한 번만 저장한다.
- `glossary_mentions_term_updated_idx` on `(term_id, page_updated_at)` — 용어별 최근 언급 페이지를 조회한다.

Notes:

- 용어 정의가 변경되면 모든 역참조를 재계산한다.
- 글이나 README만 변경되면 해당 페이지의 역참조만 교체한다.
- 페이지 URL은 `page_type`과 `page_path`로 조회 시점에 생성한다.

---

### `sync_logs`

스키마 파일: `src/infra/db/schema/syncLogs.ts`

용도: `/api/sync` 실행 이력 기록. 성공/실패, 처리 건수, HEAD commit SHA.

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

`posts` cursor 페이징과 `visit_stats` offset 페이징을 위한 복합 인덱스는 상단 각 테이블 절에 포함한다.

Drizzle 0.45.1 에서 column-level `.desc()` index chain 의 SQL 방향 직렬화가 불안정 → `sql\`${col} DESC\`` 템플릿 채택 (실측 확인 필요시 migration SQL 참조).

---
