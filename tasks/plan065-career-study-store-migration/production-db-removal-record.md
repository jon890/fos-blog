# 운영 DB study 테이블 제거 실행 기록

**실행일**: 2026-09-18 · **대상**: 홈서버 `bifos-db` 컨테이너의 `fos_blog_db`

이 문서는 `drizzle/0013_drop_study_tables.sql`을 운영 DB에 적용한 과정과 근거를 남긴다.
적용 범위는 DB 스키마 하나뿐이다.
fos-blog 애플리케이션 image와 코드는 이번 작업에서 배포하지 않았다.

## 적용 범위와 제외 대상

| 항목 | 이번 작업 |
| --- | --- |
| `fos_blog_db`의 13개 `study_` 테이블 | 제거함 |
| `__drizzle_migrations`의 0013 기록 | 추가함 |
| fos-blog 컨테이너 image | 배포하지 않음 |
| `CAREER_STUDY_BACKEND_URL`과 호출 주소 전환 | 수행하지 않음 |
| `accountbook_db`, `assistant_db`, `fos_career` | 변경하지 않음 |

## 사전 점검

읽기 전용 트랜잭션과 일관된 snapshot으로 조회했다.
비밀값은 명령과 출력 어디에도 넣지 않았다.

### 대상 테이블 상태

13개 테이블이 모두 있었고 행은 하나도 없었다.

| 확인 항목 | 결과 |
| --- | --- |
| 13개 테이블 존재 여부 | 모두 존재. 생성 시각은 2026-09-08 17:41:21 |
| 13개 테이블의 정확한 행 수 | 모두 0. 합계 0 |
| `UPDATE_TIME` | 13개 모두 `NULL` |
| auto increment 다음 값 | 해당 5개 테이블 모두 1 |

auto increment 다음 값이 1이라는 것은 생성 이후 단 한 행도 넣은 적이 없다는 뜻이다.
행을 넣었다가 지웠으면 MySQL 8이 그 값을 1보다 크게 유지한다.
따라서 이 13개 테이블은 만들어진 뒤 한 번도 쓰이지 않았다.

### 외래 키

`study_` 테이블을 가리키는 외래 키는 14개이고 모두 `study_` 테이블끼리 걸려 있다.
`study_` 바깥 테이블에서 `study_`를 가리키는 외래 키는 없다.
`study_`에서 바깥 테이블을 가리키는 외래 키도 없다.
`fos_blog_db`에는 view, trigger, stored routine이 하나도 없다.

### migration 적용 상태

`__drizzle_migrations`에는 13행이 있었고 마지막 행의 hash가 `d8953b45`로 시작했다.
이 값은 `drizzle/0012_tired_luminals.sql`의 SHA-256과 같다.
즉 0012까지 적용됐고 0013은 적용되지 않은 상태였다.

### 기존 endpoint 접근 기록

운영 컨테이너 로그에서 `study` 문자열이 한 번도 나오지 않았다.
다만 이 로그는 컨테이너가 시작한 2026-09-17 16:38 이후만 담고 있어 근거 범위가 하루뿐이다.
접근 기록을 남기는 2단계 image는 운영에 배포된 적이 없다.

그래서 사용 여부의 근거는 로그가 아니라 테이블 자체의 상태로 삼았다.
행 수 0과 auto increment 1은 쓰기가 한 번도 없었다는 직접 근거다.

**판정**: 빈 상태

## 이전 조사 기록과의 차이

`docs/study-store-migration.md`는 2026-09-17 조사에서 13개 테이블이 모두 없고
`0012_tired_luminals`도 적용되지 않았다고 적었다.
그 조사는 worktree의 공유 `.env`가 가리키는 DB를 대상으로 삼았는데,
그 주소인 `127.0.0.1:13307`은 홈서버가 아니라 개발용 로컬 MySQL 컨테이너다.

운영 DB의 실제 상태는 그와 달랐다.
13개 테이블이 모두 있었고 0012도 적용돼 있었다.
행이 없다는 결론만 우연히 같았다.

운영 DB를 조회하려면 홈서버의 `bifos-db` 컨테이너를 대상으로 삼아야 한다.

## backup

migration을 적용하기 전에 `fos_blog_db` 전체를 논리 backup으로 만들었다.

| 항목 | 값 |
| --- | --- |
| 경로 | `/opt/backup/fos-blog-db/20260917T235048Z-pre-0013-drop-study/fos_blog_db.sql` |
| 크기 | 19,388,801 바이트 |
| SHA-256 | `edac9fdd75e52228022d289527440fdbc35cbc4b7a8779d9acc5d383f4387b9a` |
| 디렉터리 권한 | 700 |
| 파일 권한 | 600 |
| 담긴 `CREATE TABLE` | 27개. 그중 `study_` 13개 |
| manifest | 같은 디렉터리의 `manifest.txt` |

`mysqldump`에 `--single-transaction`, `--routines`, `--triggers`, `--events`, `--hex-blob`을 주었다.
파일 끝에 `Dump completed` 표시가 있는 것을 확인했다.

### 복원 명령

```sh
docker exec -i bifos-db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' \
  < /opt/backup/fos-blog-db/20260917T235048Z-pre-0013-drop-study/fos_blog_db.sql
```

dump에 `CREATE DATABASE`와 `USE`가 들어 있어 이 명령은 `fos_blog_db`를 통째로 덮어쓴다.

### 복원 가능 여부 확인

명령을 그대로 실행하면 운영 DB를 덮어쓰므로, database 식별자만 임시 이름으로 바꿔 실제로 넣어 보았다.
`fos_blog_db_restorecheck`에 적재한 뒤 원본과 비교하고 그 임시 database를 지웠다.

| 비교 항목 | 복원본 | 원본 |
| --- | --- | --- |
| 테이블 수 | 27 | 27 |
| `study_` 테이블 수 | 13 | 13 |
| `posts` 행 수 | 520 | 520 |
| `visit_logs` 행 수 | 75,464 | 75,464 |
| `__drizzle_migrations` 행 수 | 13 | 13 |

임시 database를 지운 뒤 `SHOW DATABASES`가 원래 8개로 돌아온 것을 확인했다.

## migration 적용

운영 컨테이너가 부팅할 때 쓰는 것과 같은 경로로 적용했다.
컨테이너는 `node migrate.js`를 실행하고, 그 파일은 `scripts/migrate.ts`를 묶은 것이다.
같은 스크립트를 이 worktree에서 `pnpm db:migrate:runtime`으로 실행했다.

```sh
ssh -f -N -L 127.0.0.1:13399:127.0.0.1:13306 homeserver
DATABASE_URL=<운영 값의 host를 127.0.0.1:13399로 바꾼 것> pnpm db:migrate:runtime
```

drizzle migrator가 journal을 읽어 미적용 migration만 적용하고 `__drizzle_migrations`에 기록한다.
`SQL`을 손으로 실행하거나 journal 행을 손으로 넣지 않았다.
적용 직전에 13개 테이블의 행 수를 한 번 더 세어 모두 0인 것을 확인했다.

출력은 `[migrate] applying migrations`와 `[migrate] migrations applied` 두 줄이었다.
기록된 시각은 2026-09-18 08:24:01 이다.

## 적용 결과

### 테이블

| 항목 | 적용 전 | 적용 후 |
| --- | --- | --- |
| `fos_blog_db` 전체 테이블 수 | 27 | 14 |
| `study_` 테이블 수 | 13 | 0 |

남은 14개는 `__drizzle_migrations`, `auth_account`, `auth_session`, `auth_user`,
`auth_verification`, `categories`, `comments`, `folders`, `glossary_mentions`,
`glossary_terms`, `posts`, `sync_logs`, `visit_logs`, `visit_stats` 다.
`study_` 바깥 테이블은 하나도 지워지지 않았다.

### migration 기록

`__drizzle_migrations`에 14번 행이 생겼고 hash는 `9141406b00b1a61b11da0efea4d6a20af791e233dc6eaa2e594840a0b27dec79` 다.
이 값은 `drizzle/0013_drop_study_tables.sql`의 SHA-256과 같다.

이 기록이 있으므로 다음 배포에서 컨테이너가 같은 migration을 다시 실행하지 않는다.

### 비대상 database

| database | 테이블 수 |
| --- | --- |
| `accountbook_db` | 11 |
| `assistant_db` | 8 |
| `fos_career` | 15 |

### blog 서비스 상태

컨테이너는 `running` 이고 재시작 횟수는 0이다.

| 경로 | 응답 |
| --- | --- |
| `/` | 200 |
| `/categories` | 200 |
| `/series` | 200 |
| `/glossary` | 200 |
| `/rss.xml` | 200 |
| `/api/search?q=java` | 200 |
| `/admin/login` | 200 |

적용 뒤 컨테이너 로그에 오류 수준 기록이 없다.

### 콘텐츠 데이터

| 테이블 | 행 수 |
| --- | --- |
| `posts` | 520 |
| `categories` | 18 |
| `folders` | 118 |
| `comments` | 5 |
| `visit_logs` | 75,464 |
| `visit_stats` | 520 |
| `sync_logs` | 1,310 |
| `auth_account` | 1 |

## 이번 작업과 무관한 기존 문제

`/api/search` 를 호출하면 `posts` 의 FULLTEXT 색인을 찾지 못한다는 경고가 남는다.
애플리케이션이 `LIKE` 검색으로 대체 처리해 응답은 200 이다.

이것은 이번 migration이 만든 문제가 아니다.
적용 전에 만든 backup의 `CREATE TABLE posts` 에도 FULLTEXT 색인이 없다.
`0013_drop_study_tables.sql` 은 `posts` 를 건드리지 않는다.

별도 작업으로 다루어야 한다.

## 남은 조건

DB 제거는 끝났지만 이전 자체는 끝나지 않았다.

| 남은 것 | 상태 |
| --- | --- |
| career-os Backend의 14개 HTTP 동작과 역할별 인증 | 시작하지 않음 |
| `CAREER_STUDY_BACKEND_URL`과 `CAREER_STUDY_BACKEND_TOKEN` 주입 | 수행하지 않음 |
| 호출 주소 전환 | 수행하지 않음 |
| 이 branch의 fos-blog image 배포 | 수행하지 않음 |

운영 DB에 study 테이블이 없으므로, 이 branch의 image를 배포하기 전에는
기존 `/api/study/v1` 이 동작하지 않는다.
현재 운영 image에 그 route가 들어 있지만 호출한 기록이 없고 저장할 테이블도 없다.
career-os Backend가 준비되면 image 배포와 주소 전환을 이어서 수행한다.

rollback이 필요하면 위의 복원 명령으로 backup을 되돌린다.
그 backup에는 13개 테이블의 스키마가 그대로 들어 있다.
