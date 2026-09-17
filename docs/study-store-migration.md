# 학습자료 저장소 이전 조사와 실행 기준

## 이 문서의 수명

이전을 수행하는 동안만 읽는 문서다.
결정과 책임은 아래 문서로 옮겼고, 이 파일에는 아직 수행하지 않은 절차만 남아 있다.
운영 cutover와 제거 배포가 끝나면 이 파일을 지운다.

| 옮긴 내용 | 받은 문서 |
| --- | --- |
| 데이터 소유권, 단일 writer cutover, 기존 migration 보존 결정과 근거 | `docs/adr/039-career-study-backend-ownership.md` |
| Backend client와 Server Action의 모듈 배치 | `docs/code-architecture.md` |
| 관리자 세션부터 Backend 호출까지의 흐름과 실패 분기 | `docs/flow.md` |
| 역할별 권한과 소비 호환 조건 | `docs/api/study-library.md` |
| 저장 소유권이 외부로 옮겨간 사실 | `docs/data-schema.md` |
| 저장 책임과 성공 기준 | `docs/prd.md` |

절차, 판정 방법과 검증 순서는 옮기지 않았다.
운영 cutover를 수행할 때 이 문서를 읽어야 하므로 그때까지 남긴다.

## 현재 진행 상태

fos-blog 저장소 안에서 할 수 있는 구현은 끝났고, 운영 단계는 DB 제거만 수행했다.

| 단계 | 상태 |
| --- | --- |
| 1. career-os Backend의 14개 HTTP 동작과 역할별 인증 | 시작하지 않음 |
| 2. fos-blog의 서버 전용 client와 Server Action 전환 | branch 구현 완료 |
| 3. 사전 점검 판정과 단일 writer 호출 전환 | 사전 점검은 2026-09-18에 수행. 호출 전환은 시작하지 않음 |
| 4. (조건부) snapshot 이관과 행 검증, 관찰 | 빈 상태 판정이라 해당 없음 |
| 5. 로컬 API, 서비스, Repository와 13개 테이블 제거 | branch 구현 완료. 운영 DB의 13개 테이블은 제거함. image는 배포하지 않음 |
| 6. 책임 문서와 회귀 검증 | branch 구현 완료 |

3단계의 사전 점검과 5단계의 DB 제거는 순서를 바꿔 수행했다.
운영 DB의 13개 테이블이 행 0이고 한 번도 쓰인 적이 없어 되돌릴 대상이 없었기 때문이다.
그 근거는 `tasks/plan065-career-study-store-migration/production-db-removal-record.md`가 소유한다.

2단계와 5단계는 서로 다른 image다.
2단계 image는 로컬 `/api/study/v1`과 study 테이블이 살아 있는 커밋에서 빌드해야 하고,
5단계 image는 그것을 지운 커밋에서 빌드한다.
branch의 커밋 순서가 그 경계를 나눈다.

### 아직 남은 배포 선행 조건

1. career-os Backend가 14개 동작과 역할별 인증, 저장 테스트를 통과한다.
   현재 fos-blog의 소비측 검증은 계약대로 응답하는 mock HTTP server로만 수행했다.
2. 운영 환경에 `CAREER_STUDY_BACKEND_URL`과 `admin-gateway` token을 주입한다.
   producer token은 별도 값으로 career-os에 주입한다.
3. 호출 주소를 전환하고 권한 경계와 rollback 경로를 확인한다.
4. 그 결과를 확인한 뒤에야 5단계 제거 image를 배포한다.

3번 항목의 사전 점검은 2026-09-18에 끝났고 빈 상태로 판정했다.
운영 Backend 검증 전에는 기존 운영 API를 지우지 않는다.

## 조사 결론

career-os의 작은 HTTP Backend가 학습자료 수집, 개인 상태, 추천과 게시 이력의 데이터 소유자가 된다.
fos-blog는 관리자 화면과 Better Auth를 유지하되, 로컬 MySQL과 `/api/study/v1` 대신 서버에서 새 Backend를 호출한다.
브라우저에는 Backend 주소와 토큰을 노출하지 않고 Next.js Server Action이 관리자 세션을 확인한 뒤 요청을 전달한다.

2026-09-17 조사는 이 worktree의 공유 `.env`가 가리키는 DB를 읽기 전용 트랜잭션으로 조회했고
13개 테이블이 모두 없으며 `0012_tired_luminals`도 적용되지 않았다고 기록했다.
그 주소인 `127.0.0.1:13307`은 개발용 로컬 MySQL 컨테이너이고 운영 DB가 아니다.

2026-09-18에 홈서버 `bifos-db` 컨테이너의 `fos_blog_db`를 같은 방식으로 조회한 결과는 달랐다.
13개 테이블이 모두 있었고 `0012_tired_luminals`도 적용돼 있었다.
다만 13개 모두 행이 0이고 auto increment 다음 값이 1이어서, 만들어진 뒤 한 번도 쓰이지 않았다.
따라서 옮길 운영 행은 없다.

이 판정에 따라 같은 날 `0013_drop_study_tables`를 운영 DB에 적용해 13개 테이블을 제거했다.
근거와 backup 위치는 `tasks/plan065-career-study-store-migration/production-db-removal-record.md`가 소유한다.
운영 DB를 조회할 때는 공유 `.env`가 아니라 홈서버 `bifos-db`를 대상으로 삼는다.

이전은 dual-write 없이 단일 writer를 바꾸는 방식으로 진행한다.
career-os의 수집과 추천 실행, fos-blog 관리자 쓰기를 잠시 중지한 뒤 호출 주소를 새 Backend로 바꾸고 쓰기를 재개한다.
옮길 행이 있으면 쓰기를 중지한 상태에서 하나의 일관된 snapshot을 먼저 이관한다.

fos-blog의 테이블과 API를 언제 삭제할 수 있는지는 cutover 직전 사전 점검의 결과가 정한다.
13개 테이블이 모두 없고 `0012_tired_luminals`가 미적용이며 기존 endpoint와 producer 사용 내역이 없으면
옮길 데이터와 되돌릴 대상이 없으므로 관찰 기간 없이 제거 단계로 넘어간다.
테이블이나 사용 내역이 하나라도 있으면 snapshot 이관, 행 검증, rollback 확인과 관찰 기간을 적용한다.
어느 경로에서도 career-os의 14개 HTTP 계약과 저장 테스트, fos-blog 서버 전용 client와
관리자 화면 smoke test가 통과하고 호출 전환이 검증되기 전에는 기존 API 코드를 삭제하지 않는다.

## 실행 순서와 통과 조건

단계는 서로 독립으로 검증하고, 앞 단계의 증거가 없으면 뒤 단계를 시작하지 않는다.

| 단계 | 하는 일 | 실행 저장소 | 시작 조건 |
| --- | --- | --- | --- |
| 1 | career-os Backend가 14개 HTTP 동작과 역할별 인증, 저장 테스트를 통과한다 | career-os | 없음 |
| 2 | fos-blog가 서버 전용 client와 Server Action으로 새 Backend를 호출하게 바꾼다 | fos-blog | 1단계 계약 통과 기록 |
| 3 | 사전 점검으로 데이터 유무를 판정하고 단일 writer를 새 Backend로 바꾼다 | fos-blog와 운영 환경 | 2단계 image가 배포 가능 |
| 4 | (조건부) snapshot을 이관하고 행과 계약을 검증한 뒤 관찰한다 | fos-blog와 운영 환경 | 3단계 사전 점검이 데이터나 사용 내역을 찾음 |
| 5 | 기존 `/api/study/v1`, 서비스, Repository와 13개 테이블을 forward migration으로 제거한다 | fos-blog | 3단계 전환 검증 완료, 해당하면 4단계 완료 |
| 6 | 책임 문서를 새 소유권으로 고치고 회귀를 검증한다 | fos-blog | 5단계 제거 완료 |

### 배포 순서 조건

Docker 컨테이너는 `node migrate.js && node server.js`로 서버보다 먼저 migration을 실행한다.
따라서 study 테이블을 drop하는 image가 배포되는 순간 fos-blog의 로컬 저장은 되돌릴 수 없다.

| image | 배포 가능 시점 | 확인할 증거 |
| --- | --- | --- |
| 2단계 client 전환 image | career-os Backend가 14개 동작과 역할별 인증을 통과한 뒤 | Backend 계약 테스트 결과와 Backend 주소 |
| 5단계 제거 image | 3단계 호출 전환 검증이 끝나고, 데이터 경로면 4단계까지 끝난 뒤 | 전환 검증 기록과 사전 점검 판정 |

API가 준비되지 않은 상태에서 2단계 image를 배포하면 관리자 화면이 모두 실패한다.
전환 검증이 끝나기 전에 5단계 image를 배포하면 rollback 대상이 사라진다.
두 조건은 배포를 실행하는 사람이 증거 기록을 확인한 뒤에만 해제한다.

## 조사 범위와 제약

이번 조사는 다음 항목을 대상으로 삼았다.

- `src/infra/db/schema/study.ts`와 `drizzle/0012_tired_luminals.sql`의 13개 테이블
- `src/app/api/study/v1/`의 14개 HTTP 동작
- `src/services/study/`, `StudyRepository`, `StudyImportRepository`의 트랜잭션과 멱등 처리
- 관리자 학습자료 화면과 브라우저 호출부
- 테스트, 환경 변수, Docker 부팅 migration, 배포 설정과 책임 문서
- 공유 `.env`가 가리키는 DB의 테이블 존재 여부, 행 수와 migration 적용 여부

2026-09-17 조사에서는 DB, migration, 컨테이너와 외부 서비스를 변경하지 않았다.
DB 조회는 자격증명을 출력하지 않고 `SET SESSION TRANSACTION READ ONLY`와 일관된 snapshot을 사용했다.
그 조사가 본 DB는 개발용 로컬 MySQL이었고 테이블이 없어 행 수를 `해당 없음`으로 판정했다.

운영 DB를 대상으로 한 2026-09-18 실행은 같은 읽기 전용 조회 방식을 쓰고 그 뒤에 migration을 적용했다.

## 현재 구현 영향

### 데이터와 migration

13개 테이블은 `drizzle/0012_tired_luminals.sql`에서 한 번에 만들어진다.
모든 외래 키가 `RESTRICT`라서 제거 migration은 자식 테이블부터 명시적인 순서로 삭제해야 한다.
Docker image는 `scripts/migrate.ts`를 `migrate.js`로 묶고 컨테이너가 시작할 때 `drizzle/`의 미적용 migration을 먼저 실행한다.
따라서 drop migration이 포함된 fos-blog image는 호출 전환 검증이 끝난 뒤에만 배포할 수 있고,
데이터 있음으로 판정했으면 관찰 기간까지 끝나야 배포할 수 있다.

기존 `drizzle/0012_tired_luminals.sql`, `drizzle/meta/0012_snapshot.json`과 journal 항목은 이력으로 보존한다.
제거는 현재 스키마에서 새 forward migration을 생성하고 새 snapshot을 추가하는 방식으로 처리한다.
과거 migration과 snapshot을 편집하거나 삭제하지 않는다.

### API와 인증

현재 API는 `/api/study/v1` 아래에서 동기 JSON으로 동작하며 요청 본문은 1 MiB로 제한한다.
오류는 `{error:{code,message,requestId}}`이고 개인 응답에는 `private, no-store`와 `noindex, nofollow`를 붙인다.

| 동작 | 현재 주체 | 새 Backend 주체 | 계약 판단 |
| --- | --- | --- | --- |
| `PUT /sources/{sourceKey}` | career-os Bearer | producer token | 요청과 응답 유지 |
| `GET /sources` | career-os Bearer 또는 관리자 세션 | producer 또는 admin-gateway token | 요청과 응답 유지 |
| `GET /sources/{sourceKey}/cursor?mode=` | career-os Bearer | producer token | 요청과 응답 유지 |
| `POST /ingestions` | career-os Bearer | producer token | 원자 저장과 멱등 계약 유지 |
| `GET /materials` | 관리자 세션 | admin-gateway token | 필터와 cursor 유지 |
| `GET /materials/{id}` | 관리자 세션 | admin-gateway token | 응답 유지 |
| `PATCH /materials/{id}/state` | 관리자 세션과 Origin | admin-gateway token | 버전 충돌 계약 유지 |
| `GET /candidates` | career-os Bearer | producer token | 이력 버전과 후보 계약 유지 |
| `GET /recommendation-runs` | 관리자 세션 | admin-gateway token | 페이지 계약 유지 |
| `POST /recommendation-runs` | career-os Bearer | producer token | 멱등과 중복 방지 유지 |
| `GET /recommendation-runs/{reportId}` | 관리자 세션 | admin-gateway token | snapshot과 현재 상태 구분 유지 |
| `POST /publications` | career-os Bearer | producer token | 게시 성공 기록만 저장 |
| `POST /imports/dry-run` | career-os Bearer 또는 관리자 세션 | producer 또는 admin-gateway token | 무수정 미리보기 유지 |
| `POST /imports/commit` | 관리자 세션과 Origin | admin-gateway token | 미리보기 hash와 이력 버전 유지 |

새 Backend는 기본 경로, DTO, 상태 코드, 멱등 키, URL 정규화와 cursor 형식을 바꾸지 않는다.
인증만 브라우저 세션 대신 역할이 구분된 서버용 Bearer로 바꾼다.
`producer`는 수집과 추천 쓰기만 수행하고 개인 상태 수정과 import commit은 거절한다.
`admin-gateway`는 fos-blog Server Action에서만 사용하고 수집과 추천 생성은 거절한다.

fos-blog의 Better Auth는 관리자 화면의 본인 확인을 계속 담당한다.
Server Action은 `getAdminSession`으로 세션과 허용 GitHub numeric ID를 확인한 뒤 `admin-gateway` token을 사용한다.
브라우저는 새 Backend를 직접 호출하지 않으며 token을 HTML, RSC payload, JavaScript bundle과 로그에 넣지 않는다.

### 서비스와 Repository

| 현재 모듈 | 책임 | 이전 뒤 처리 |
| --- | --- | --- |
| `src/services/study/sources.ts` | 소스 전체 교체와 cursor 조회 | career-os Backend로 이동하고 fos-blog에서 삭제 |
| `src/services/study/ingestion.ts` | 배치 수집과 영수증 재시도 | career-os Backend로 이동하고 fos-blog에서 삭제 |
| `src/services/study/materials.ts` | 자료 조회와 개인 상태 수정 | career-os Backend로 이동하고 fos-blog에서 삭제 |
| `src/services/study/recommendations.ts` | 후보, 추천, 게시 이력 | career-os Backend로 이동하고 fos-blog에서 삭제 |
| `src/services/study/imports.ts` | 이력 미리보기와 commit | career-os Backend로 이동하고 fos-blog에서 삭제 |
| `src/services/study/deadlock-retry.ts` | deadlock 재시도 | 새 저장소 구현에 맞춰 Backend가 책임지고 fos-blog에서 삭제 |
| `src/services/study/errors.ts` | 도메인 오류 변환 | Backend가 HTTP 오류 계약으로 구현하고 fos-blog에는 client 오류만 유지 |
| `StudyRepository.ts` | 13개 테이블 조회와 쓰기 | Backend 저장 계층으로 이동하고 fos-blog에서 삭제 |
| `StudyImportRepository.ts` | import dry-run과 commit | Backend 저장 계층으로 이동하고 fos-blog에서 삭제 |

현재 서비스와 Repository의 테스트는 로컬 MySQL 트랜잭션, 잠금, 멱등과 충돌을 검증한다.
이 동작은 삭제할 테스트와 함께 사라지면 안 되며, 새 Backend의 저장 계층과 HTTP 계약 테스트로 먼저 옮겨야 한다.

### 관리자 화면

`src/app/admin/(protected)/study/`와 `src/components/study/`는 유지한다.
현재 client component가 상대 경로 `/api/study/v1`을 호출하고 일부 server component가 서비스를 직접 호출하므로 그대로 둘 수는 없다.

fos-blog에 서버 전용 HTTP client와 Server Action을 추가한다.
조회 page는 서버 전용 client를 사용하고, 브라우저 상호작용은 Server Action을 props로 전달받는다.
화면의 DTO와 오류 표시는 유지하되 producer 전용 요청 스키마, URL 식별과 멱등 hash 구현은 Backend로 이동한다.

### 환경 변수와 배포

| 항목 | 처리 |
| --- | --- |
| `STUDY_SERVICE_TOKEN` | fos-blog가 받는 inbound token이므로 로컬 API 제거 뒤 삭제 |
| `CAREER_STUDY_BACKEND_URL` | fos-blog 서버가 호출할 HTTPS base URL로 추가. 로컬에서는 loopback HTTP만 허용 |
| `CAREER_STUDY_BACKEND_TOKEN` | `admin-gateway` 권한의 서버 비밀값으로 추가 |
| Better Auth와 GitHub OAuth 변수 | 관리자 화면을 유지하므로 유지 |
| `DATABASE_URL` | 공개 블로그와 관리자 세션이 계속 MySQL을 사용하므로 유지 |
| `Dockerfile`, `scripts/migrate.ts` | 새 drop migration을 기존 방식으로 적용하므로 유지 |
| `local/docker-compose.yml` | MySQL 개발 환경이 계속 필요하므로 유지 |
| `.github/workflows/deploy.yml` | image 빌드 경로는 유지. 운영 배포 환경에 새 변수만 주입 |

새 외부 의존성은 필요하지 않다.
현재 `fetch`, Zod, Server Action과 기존 인증 코드를 재사용한다.
`better-auth`, Drizzle과 MySQL은 학습자료 제거 뒤에도 관리자 세션과 블로그 데이터 때문에 유지한다.

## 13개 테이블 판정

모든 논리 데이터의 소유권은 career-os Backend로 옮긴다.
초기 이전에서는 필드와 키를 유지해 API와 이관 검증을 단순하게 만들고,
새 Backend 안에서 별도 최적화가 필요하면 cutover 뒤 독립 migration으로 다룬다.

| 테이블 | 데이터 소유권과 역할 | 모델 판정 | fos-blog 최종 처리 | 2026-09-18 운영 실행 |
| --- | --- | --- | --- | --- |
| `study_sources` | Backend가 소스 설정과 version 소유 | 재사용 | 자식 이관과 검증 뒤 drop | 행 0으로 확인한 뒤 drop 완료 |
| `study_source_cursors` | Backend가 소스와 mode별 수집 진도 소유 | 재사용 | 수집 중지 snapshot 뒤 drop | 행 0으로 확인한 뒤 drop 완료 |
| `study_materials` | Backend가 URL 식별 자료와 수집 시각 소유 | 재사용 | ID와 contentKey 보존 이관 뒤 drop | 행 0으로 확인한 뒤 drop 완료 |
| `study_material_sources` | Backend가 자료와 소스의 다대다 연결 소유 | 재사용 | 양쪽 부모 검증 뒤 drop | 행 0으로 확인한 뒤 drop 완료 |
| `study_material_tags` | Backend가 자료 태그 소유 | 재사용 | materialId 검증 뒤 drop | 행 0으로 확인한 뒤 drop 완료 |
| `study_material_states` | Backend가 본인 즐겨찾기, 읽음, 메모와 version 소유 | 재사용 | admin 화면 cutover 뒤 drop | 행 0으로 확인한 뒤 drop 완료 |
| `study_recommendation_control` | Backend가 이력 version, 최신 run과 직렬화 잠금 소유 | 재사용 | run과 version 검증 뒤 drop | 행 0으로 확인한 뒤 drop 완료 |
| `study_recommendation_runs` | Backend가 리포트 영수증과 commit 순서 소유 | 재사용 | reportId와 ID 보존 이관 뒤 drop | 행 0으로 확인한 뒤 drop 완료 |
| `study_recommendation_topics` | Backend가 run별 주제 snapshot과 순서 소유 | 재사용 | run FK 검증 뒤 drop | 행 0으로 확인한 뒤 drop 완료 |
| `study_recommendation_items` | Backend가 추천 당시 자료 snapshot과 순서 소유 | 재사용 | run, topic, material FK 검증 뒤 drop | 행 0으로 확인한 뒤 drop 완료 |
| `study_recommended_materials` | Backend가 누적 추천 중복 집합 소유 | 재사용 | 누적 집합 비교 뒤 drop | 행 0으로 확인한 뒤 drop 완료 |
| `study_publications` | Backend가 외부 게시 성공 이력 소유 | 재사용 | run별 이력 비교 뒤 drop | 행 0으로 확인한 뒤 drop 완료 |
| `study_request_receipts` | Backend가 ingestion, publication, import 멱등 영수증 소유 | 재사용 | hash와 응답 JSON 보존 뒤 drop | 행 0으로 확인한 뒤 drop 완료 |

`owner_key`는 현재 한 명만 사용해도 초기 이관에서 유지한다.
이를 없애면 상태와 추천 제어 키를 동시에 바꾸고 rollback 변환도 추가해야 하므로 cutover 변경에 포함하지 않는다.

## 데이터 이관 순서

### 사전 점검과 분기

1. career-os Backend가 14개 HTTP 동작과 저장 테스트를 통과하고 production 요청은 아직 받지 않게 배포한다.
2. fos-blog의 13개 테이블 존재 여부와 `0012_tired_luminals` 적용 여부를 읽기 전용으로 다시 조회한다.
3. 테이블이 있으면 13개 정확한 행 수, 최대 auto increment ID와 외래 키 누락 수를 기록한다.
4. 기존 `/api/study/v1` 접근 내역과 career-os producer 실행 내역이 있는지 조회한다.
5. career-os 수집과 추천 job, fos-blog 관리자 상태 쓰기와 import commit을 중지할 수 있는지 확인한다.

사전 점검의 결과가 이어지는 경로를 정한다.

| 판정 | 조건 | 이어지는 처리 |
| --- | --- | --- |
| 빈 상태 | 13개 테이블이 모두 없고 `0012_tired_luminals`가 미적용이며 endpoint와 producer 사용 내역이 없다 | snapshot 이관, 행 검증과 관찰 기간을 생략하고 계약 검증만 수행한다 |
| 데이터 있음 | 테이블, 행 또는 사용 내역이 하나라도 있다 | 아래 snapshot과 import, 검증과 관찰 기간을 모두 적용한다 |

빈 상태 판정에서도 Backend의 schema migration과 14개 API smoke test, 역할별 인증 확인은 생략하지 않는다.
판정 근거는 비밀값 없이 조회 시각, 조회 대상과 결과로 남긴다.
판정이 애매하면 데이터 있음으로 처리한다.

### 사용 내역 판정 방법

기존 구현은 오류만 로그로 남기므로 성공한 요청의 흔적이 남지 않는다.
사용 내역을 판정하려면 2단계 image가 남기는 접근 기록을 읽는다.
그 기록은 14개 route가 모두 거치는 `authorizeStudyRequest` 한 곳에서 나온다.
기록에는 method, 경로와 주체 종류만 들어 있고 token, query, 메모와 요청 본문은 들어 있지 않다.
5단계 커밋이 그 함수를 route와 함께 지우므로, 이 기록은 2단계 image를 배포한 기간에만 쌓인다.

| 확인할 것 | 방법 |
| --- | --- |
| 기존 endpoint 접근 | 2단계 배포 뒤 컨테이너 로그에서 접근 기록을 조회한다 |
| 기존 테이블 쓰기 | 13개 테이블의 행 수, 최대 auto increment와 최신 `updated_at`을 두 시점에 조회해 비교한다 |
| producer 실행 | career-os job의 최근 실행 기록과 대상 주소를 확인한다 |

### snapshot과 import

데이터 있음으로 판정했을 때만 수행한다.

쓰기 중지 뒤 하나의 일관된 snapshot에서 다음 순서로 내보내고 가져온다.

1. `study_sources`
2. `study_source_cursors`
3. `study_materials`
4. `study_material_sources`
5. `study_material_tags`
6. `study_material_states`
7. `study_recommendation_runs`
8. `study_recommendation_topics`
9. `study_recommendation_items`
10. `study_recommended_materials`
11. `study_publications`
12. `study_recommendation_control`
13. `study_request_receipts`

auto increment ID는 새로 만들지 않고 원래 값을 보존한다.
`study_recommendation_control.latest_run_id`, 추천 item의 세 FK와 누적 추천의 `first_run_id`가 원래 대상을 가리켜야 하기 때문이다.
import가 끝나면 각 auto increment의 다음 값이 이관한 최대 ID보다 큰지 확인한다.

### 검증과 전환

빈 상태와 데이터 있음이 확인할 조건이 다르다.
아래 표의 조건을 모두 만족한 뒤 단일 writer를 새 Backend로 바꾼다.

| 조건 | 빈 상태 | 데이터 있음 |
| --- | --- | --- |
| 13개 테이블의 원본과 대상 행 수가 같다 | 해당 없음 | 확인 |
| PK와 unique key를 정렬해 계산한 표별 hash가 같다 | 해당 없음 | 확인 |
| 모든 외래 키 누락 수가 0이다 | 해당 없음 | 확인 |
| `history_version`, `latest_run_id`, cursor version, 상태 version과 멱등 응답이 같다 | 해당 없음 | 확인 |
| 같은 fixture로 fos-blog 기존 API와 새 Backend의 정상 응답과 오류 code가 같다 | 확인 | 확인 |
| 관리자 자료 조회, 상태 수정, 추천 상세와 import dry-run 및 commit이 Server Action을 통해 동작한다 | 확인 | 확인 |
| career-os의 소스 조회, 빈 ingestion, 후보 조회, 빈 추천 run과 게시 영수증 smoke test가 동작한다 | 확인 | 확인 |
| producer token으로 개인 상태 수정과 import commit이 403이다 | 확인 | 확인 |
| admin-gateway token으로 수집과 추천 생성이 403이다 | 확인 | 확인 |

`해당 없음`은 원본에 옮길 행이 없어서 비교 대상이 없다는 뜻이며, 확인을 건너뛴 것이 아니다.
빈 상태에서도 이 판정 근거를 기록으로 남긴다.

검증이 끝나면 career-os의 `STUDY_LIBRARY_URL`과 fos-blog의 `CAREER_STUDY_BACKEND_URL`을 새 Backend로 바꾼다.
fos-blog 서버에는 `admin-gateway` token을, producer에는 별도 producer token을 주입한다.
기존 fos-blog API와 테이블은 읽기 전용 rollback 원본으로 남기고 쓰기 중지만 유지한다.

## rollback과 삭제 조건

### rollback

자료 손실, 계약 불일치, 권한 오류 또는 지속적인 5xx가 발생하면 새 쓰기를 먼저 중지한다.
cutover 뒤 Backend에 새 행이 없으면 호출 주소만 fos-blog로 되돌리고 기존 writer를 재개한다.
새 행이 있으면 Backend snapshot에서 cutover 시점 이후의 ID, version과 영수증을 추출해 fos-blog에 reverse import하고
13개 행 수, key hash와 FK를 다시 확인한 뒤 주소를 되돌린다.

빈 상태 판정에서는 fos-blog에 되돌릴 원본이 없다.
이때의 rollback은 데이터 복구가 아니라 호출 주소를 되돌려 fos-blog 저장으로 다시 쓰기를 시작하는 것이다.
제거 단계 전에는 그 저장이 그대로 남아 있으므로 주소 전환만으로 충분하다.

dual-write를 rollback 수단으로 사용하지 않는다.
양쪽에 동시에 쓴 결과를 합치는 대신 쓰기를 멈추고 한쪽 snapshot을 다른 쪽에 반영한다.
fos-blog drop migration이 적용된 뒤에는 주소 전환만으로 rollback할 수 없으므로 DB backup 복구가 필요하다.

### fos-blog 삭제 조건

경로와 무관하게 다음 조건을 모두 충족해야 fos-blog 제거 단계를 시작한다.

1. career-os Backend의 14개 HTTP 계약과 저장 테스트가 통과했다.
2. producer와 admin-gateway 역할 구분이 양쪽 방향에서 403으로 확인됐다.
3. fos-blog 서버 전용 client와 관리자 화면 smoke test가 새 Backend 주소로 통과했다.
4. career-os job과 fos-blog 관리자 화면의 호출 주소가 새 Backend로 전환됐다.
5. cutover 직전 사전 점검의 판정과 근거가 기록으로 남아 있다.
6. Backend backup과 restore 검증이 끝났다.

데이터 있음으로 판정했으면 아래 조건을 함께 충족해야 한다.

1. cutover 시점의 13개 테이블 행 수, key hash와 FK 검증 결과가 보존돼 있다.
2. 합의한 관찰 기간 동안 기존 `/api/study/v1` 접근과 기존 테이블 쓰기가 없었다.
3. rollback 담당자가 fos-blog DB backup 위치와 reverse import 절차를 확인했다.

빈 상태로 판정했으면 옮긴 행과 되돌릴 원본이 없으므로 관찰 기간을 두지 않는다.
대신 제거 단계를 시작하기 직전에 사전 점검을 한 번 더 수행해 같은 판정이 나오는지 확인한다.
판정이 달라지면 제거를 멈추고 데이터 있음 경로로 전환한다.

조건을 만족하지 않으면 코드, API와 테이블을 유지하고 원인을 고친다.

## fos-blog 파일 처리 목록

### 새 Backend 연결 때 수정하거나 추가할 파일

| 경로 | 처리 |
| --- | --- |
| `src/env.ts`, `.env.example` | Backend URL과 admin-gateway token 추가, cutover 뒤 inbound token 삭제 |
| `src/lib/study/backend-client.ts` | 서버 전용 fetch, timeout, 오류 envelope와 응답 Zod 검증 추가 |
| `src/app/admin/(protected)/study/actions.ts` | 관리자 세션 확인과 조회·쓰기 Server Action 추가 |
| `src/app/admin/(protected)/study/recommendations/[reportId]/page.tsx` | `getRecommendationRun` 직접 호출을 Backend client 호출로 변경 |
| `src/components/study/StudyLibrary.tsx` | `/api/study/v1` 자료와 소스 fetch를 action props 호출로 변경 |
| `src/components/study/RecommendationReport.tsx` | 리포트, 자료 단건과 상태 수정 fetch를 action props 호출로 변경 |
| `src/components/study/RecommendationHistory.tsx` | 추천 목록 fetch를 action props 호출로 변경 |
| `src/components/study/ImportPanel.tsx` | dry-run과 commit fetch를 action props 호출로 변경 |
| `src/lib/study/contracts.ts` | 관리자 UI가 쓰는 DTO와 오류 스키마만 유지 |
| `src/lib/study/auth.ts` | 14개 route가 공유하는 단일 지점에 접근 기록 추가. 5단계에서 route와 함께 삭제 |
| `src/components/study/StudyLibrary.test.tsx`, `ImportPanel.test.tsx` | action props 경계를 검증하도록 변경 |
| `src/app/admin/study-workflow.test.tsx` | 서비스 mock 대신 action mock으로 변경 |

`src/app/admin/(protected)/study/`에서 서비스를 직접 부르는 곳은 추천 상세 page 하나다.
나머지 page는 `requireAdminPage()`만 호출하고 client component를 렌더한다.

### 제거 단계에서 삭제할 파일

- `src/app/api/study/v1/**`
- `src/services/study/**`
- `src/infra/db/repositories/StudyRepository.ts`
- `src/infra/db/repositories/StudyRepository.test.ts`
- `src/infra/db/repositories/StudyImportRepository.ts`
- `src/infra/db/schema/study.ts`
- `src/infra/db/schema/study.test.ts`
- `src/lib/study/auth.ts`와 `src/lib/study/auth.test.ts`
- `src/lib/study/http.ts`와 `src/lib/study/http.test.ts`
- `src/lib/study/request-hash.ts`
- `src/lib/study/url-identity.ts`와 `src/lib/study/url-identity.test.ts`

`src/app/api/study/v1/**`에는 route 외에 `storage-routes.test.ts`, `recommendation-routes.test.ts`와
`__fixtures__/career-os-plan115.ts`가 있다.
career-os 호환 fixture는 `src/lib/study/__fixtures__/career-os-plan115.ts`로 옮겼다.
career-os Backend가 구현되면 그 저장소로 다시 옮기고 `docs/api/study-library.md`의 참조 경로를 함께 고친다.
`src/services/study/**`에는 다섯 개 서비스 테스트가 함께 있어 같은 조건이 적용된다.
`src/lib/study/contracts.ts`와 `contracts.test.ts`는 삭제하지 않고 producer 전용 요청 스키마만 뺀다.

### 함께 수정할 파일

| 경로 | 처리 |
| --- | --- |
| `src/infra/db/repositories/index.ts` | StudyRepository export와 factory 항목 삭제 |
| `src/infra/db/schema/index.ts` | study schema export 삭제 |
| `next.config.ts` | `/api/study/:path*` 응답 헤더 설정 삭제. `/admin`과 `/api/auth`는 유지 |
| `drizzle/meta/_journal.json` | 생성 도구가 추가하는 forward migration 항목만 반영 |
| `drizzle/meta/0013_snapshot.json` 이후 생성 파일 | study 테이블이 없는 새 snapshot 추가 |
| `docs/prd.md` | 저장 책임을 career-os Backend로 변경 |
| `docs/flow.md` | fos-blog Server Action과 Backend 호출 흐름으로 변경 |
| `docs/code-architecture.md` | Repository와 Route Handler 대신 Backend client 책임 기록 |
| `docs/data-schema.md` | fos-blog study 테이블 절 삭제, 외부 소유 데이터 링크 추가 |
| `docs/api/study-library.md` | fos-blog 제공 API 문서에서 Backend 소비 계약으로 변경 |
| `docs/adr/037-private-study-domain.md` | 저장 위치 결정을 새 ADR이 대체한 부분으로 표시 |
| `docs/adr/038-study-atomic-ingestion.md` | fos-blog 저장 결정은 superseded로 표시하고 Backend 계약으로 연결 |
| `docs/adr/README.md` | 새 저장 소유권 ADR 링크 추가 |

### 보존할 파일과 설정

- `drizzle/0012_tired_luminals.sql`
- `drizzle/meta/0012_snapshot.json`
- `src/app/admin/`의 공통 로그인, 보호 layout과 관리자 홈
- `src/components/admin/`, `src/lib/admin/`, `src/app/api/auth/`
- `src/infra/db/schema/auth.ts`와 인증 schema 테스트
- Better Auth와 GitHub OAuth 환경 변수
- `Dockerfile`, `scripts/migrate.ts`, `local/docker-compose.yml`, `.github/workflows/deploy.yml`
- Drizzle, MySQL, Zod와 Better Auth 의존성

기존 study API와 DB 테스트를 삭제하기 전에 새 Backend의 같은 동작 테스트가 통과해야 한다.
fos-blog에는 Backend client의 timeout, 잘못된 JSON, 오류 code 전달, 토큰 비노출, 관리자 세션 거절과 UI 충돌 복구 테스트를 남긴다.

## 문서 영향 판정

| 문서 | 현재 처리 | 제거 phase 처리 |
| --- | --- | --- |
| `docs/prd.md` | 현재 동작을 설명하므로 유지 | 소유권과 성공 기준 수정 |
| `docs/flow.md` | 현재 호출 흐름을 설명하므로 유지 | Server Action과 새 Backend 흐름 수정 |
| `docs/code-architecture.md` | 현재 모듈 배치를 설명하므로 유지 | 로컬 저장 계층 삭제와 client 배치 수정 |
| `docs/data-schema.md` | 현재 스키마를 설명하므로 유지 | fos-blog study 절 삭제와 외부 소유권 기록 |
| `docs/api/study-library.md` | 이전할 계약의 기준으로 유지 | Backend 소비 계약과 인증 변경 반영 |
| ADR-037, ADR-038 | cutover 전에는 유효 | 새 ADR과 supersede 관계 기록 |
| 이 문서 | 이전을 수행하는 기준으로 유지 | 「이 문서의 수명」 절의 표대로 내용을 옮기고 삭제 |

공개 블로그 페이지와 마크다운 렌더링 계약은 이 변경의 영향을 받지 않는다.
학습자료 경로를 공개 sitemap, RSS와 검색에 포함하지 않는 조건도 유지한다.

## 완료 판정

이전 완료는 새 Backend 배포만으로 판정하지 않는다.
career-os 계약 통과, 단일 writer 전환, 계약 검증, fos-blog forward migration 적용,
`/api/study/v1` 제거와 CI 통과까지 끝나야 완료다.
데이터 있음으로 판정했으면 행 검증과 합의한 관찰 기간이 여기에 더해진다.
어느 단계에서든 삭제 조건을 만족하지 못하면 fos-blog의 기존 API, migration 이력과 테이블을 보존한다.
