# Phase 05. fos-blog study API와 저장 계층 제거

**Execution profile**: deep

## 목표

삭제 조건을 통과한 뒤 fos-blog의 로컬 study API, 서비스, Repository와 13개 테이블을 forward migration으로 제거한다.

**범위 외**: 기존 migration 파일 수정, Better Auth와 인증 테이블 제거, 공개 블로그 DB와 career-os Backend 내부 최적화는 포함하지 않는다.

## 컨텍스트

`drizzle/0012_tired_luminals.sql`과 `drizzle/meta/0012_snapshot.json`은 적용 여부와 무관하게 이력으로 보존한다.
제거는 현재 schema에서 새 forward migration을 만들고 새 snapshot을 추가하는 방식으로 처리한다.

Docker 컨테이너는 `node migrate.js && node server.js`로 서버보다 먼저 migration을 실행한다.
따라서 이 phase의 image를 배포하는 순간 fos-blog의 로컬 저장은 되돌릴 수 없다.

fos-blog 관리자 화면은 Phase 02의 Backend client와 Server Action을 계속 사용한다.
Backend client는 호환 경로 `/api/study/v1`을 base URL 뒤에 붙여 사용하므로 그 문자열 자체는 제거 대상이 아니다.

**근거 문서**: `docs/study-store-migration.md` 의 「fos-blog 삭제 조건」 절

## 의도 메모

- 새 migration은 study 테이블만 drop하며 다른 테이블과 기존 migration 파일을 바꾸지 않는다.
- Better Auth, 관리자 공통 화면과 GitHub OAuth 설정은 유지한다.
- Drizzle, MySQL, Zod와 Better Auth 의존성은 공개 블로그와 관리자 세션이 계속 사용하므로 지우지 않는다.
- 삭제 뒤 rollback은 DB backup과 이전 image가 필요하므로 삭제 조건 증거가 없으면 진행하지 않는다.

## 선행 의존과 배포 조건

| 항목 | 조건 |
| --- | --- |
| 시작 조건 | Phase 01 통과 기록, Phase 03 판정과 전환 검증 기록이 있다 |
| 추가 조건 | Phase 03 판정이 `데이터 있음`이면 Phase 04의 관찰 기록이 있어야 한다 |
| 배포 조건 | 위 증거를 확인한 뒤에만 이 phase의 image를 배포한다 |
| 배포 뒤 | 주소 전환만으로 rollback할 수 없다. DB backup 복구가 필요하다 |

## Blocked 조건

- `tasks/plan065-career-study-store-migration/backend-readiness.md`나
  `preflight-result.md`가 없으면 `PHASE_BLOCKED: Backend cutover 미완료`를 출력하고 종료한다.
- 판정이 `데이터 있음`인데 `observation-result.md`가 없으면
  `PHASE_BLOCKED: 관찰 기록 없음`을 출력하고 종료한다.
- 제거 직전 사전 점검을 다시 수행한 결과가 Phase 03의 판정과 다르면
  `PHASE_BLOCKED: 사전 점검 판정 변경`을 출력하고 종료한다.
- Backend backup과 restore 증거가 없으면 `PHASE_BLOCKED: 삭제 전 복구 검증 없음`을 출력하고 종료한다.

## 작업 항목

### 1. 제거 직전 사전 점검 재확인

Phase 03과 같은 읽기 전용 조회를 한 번 더 수행한다.
13개 테이블 존재 여부, 행 수, `0012_tired_luminals` 적용 여부와 기존 endpoint 접근 기록을 조회한다.

결과가 Phase 03의 판정과 같으면 진행한다.
빈 상태였는데 테이블이나 접근 기록이 생겼으면 제거를 멈추고 Phase 04로 되돌아간다.
재확인 결과를 `preflight-result.md`에 한 절로 덧붙인다.

### 2. 로컬 API, 서비스와 Repository 삭제

아래를 삭제한다.

- `src/app/api/study/v1/**` (13개 route, `storage-routes.test.ts`, `recommendation-routes.test.ts`, `__fixtures__/`)
- `src/services/study/**` (5개 서비스와 그 테스트, `deadlock-retry.ts`, `errors.ts`)
- `src/infra/db/repositories/StudyRepository.ts`와 `StudyRepository.test.ts`
- `src/infra/db/repositories/StudyImportRepository.ts`
- `src/lib/study/auth.ts`와 `src/lib/study/auth.test.ts`
- `src/lib/study/http.ts`와 `src/lib/study/http.test.ts`
- `src/lib/study/request-hash.ts`
- `src/lib/study/url-identity.ts`와 `src/lib/study/url-identity.test.ts`

`__fixtures__/career-os-plan115.ts`는 삭제 전에 Backend 저장소로 옮긴다.
옮긴 위치는 Phase 06에서 `docs/api/study-library.md`의 참조 경로에 반영한다.

`src/infra/db/repositories/index.ts`에서 StudyRepository export와 `getRepositories().study` 항목을 지운다.
`src/lib/study/contracts.ts`와 `contracts.test.ts`는 남기고 producer 전용 요청 스키마만 뺀다.
남은 제품 코드와 테스트에서 삭제한 모듈 import가 0건이어야 한다.

### 3. study schema와 forward migration 추가

`src/infra/db/schema/study.ts`, `src/infra/db/schema/study.test.ts`와
`src/infra/db/schema/index.ts`의 study export를 지운다.

현재 schema로 `pnpm db:generate`를 실행해 migration을 만들고 생성 SQL이 13개 study 테이블만 drop하는지 검사한다.
외래 키가 모두 `RESTRICT`라서 자식 테이블부터 명시한 순서로 지워야 한다.

1. `study_publications`
2. `study_recommendation_items`
3. `study_recommended_materials`
4. `study_recommendation_topics`
5. `study_recommendation_control`
6. `study_recommendation_runs`
7. `study_request_receipts`
8. `study_material_states`
9. `study_material_tags`
10. `study_material_sources`
11. `study_source_cursors`
12. `study_materials`
13. `study_sources`

`drizzle/0012_tired_luminals.sql`, `drizzle/meta/0012_snapshot.json`과 기존 journal 항목은 그대로 둔다.
`drizzle/meta/_journal.json`에는 생성 도구가 추가하는 새 항목만 반영한다.

### 4. API와 inbound 환경 설정 제거

`src/env.ts`의 `server`와 `runtimeEnv`, 그리고 `.env.example`에서 `STUDY_SERVICE_TOKEN`을 지운다.
`CAREER_STUDY_BACKEND_URL`과 `CAREER_STUDY_BACKEND_TOKEN`은 유지한다.

`next.config.ts`의 private header 대상 배열에서 `/api/study/:path*`만 지운다.
`/admin/:path*`와 `/api/auth/:path*`는 유지한다.

배포 환경의 옛 inbound token은 제거 image가 정상 동작한 뒤 폐기한다.

### 5. 제거 migration과 잔여 참조 테스트

격리된 `TEST_DATABASE_URL`에서 모든 migration을 처음부터 적용해
study 테이블이 남지 않고 비 study 테이블이 유지되는지 확인한다.
`0012`까지 적용된 fixture에도 새 migration을 적용해 13개 테이블만 사라지는지 확인한다.

`src/infra/db/study-removal.test.ts`를 추가해 migration 재실행이 멱등이고
`information_schema`의 `study_%` 결과가 0건인지 검증한다.
검색으로 로컬 API 경로, Repository, schema export와 inbound token 참조가 없는지 확인한다.

## 검증

격리된 loopback MySQL만 사용한다.
운영 `DATABASE_URL`을 테스트에 사용하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
RUN_DB_TESTS=1 pnpm exec vitest run 'src/infra/db/study-removal.test.ts'
test ! -e src/app/api/study/v1
test ! -e src/services/study
test ! -e src/infra/db/schema/study.ts
test -e src/lib/study/backend-client.ts
test -e src/lib/study/contracts.ts
! grep -rn 'StudyRepository\|STUDY_SERVICE_TOKEN' src .env.example next.config.ts
grep -q '/admin/:path\*' next.config.ts
grep -q '/api/auth/:path\*' next.config.ts
! grep -q '/api/study/:path\*' next.config.ts
test -e drizzle/0012_tired_luminals.sql
test -e drizzle/meta/0012_snapshot.json
pnpm lint
pnpm type-check
pnpm test
pnpm build
git diff --check
```

새 migration 적용 뒤 13개 study 테이블이 없고 기존 블로그와 인증 테이블이 남아야 phase가 끝난다.

## 후속 Dispatch 단위

| Dispatch | 범위 |
| --- | --- |
| 제거 직전 사전 점검 재확인 | 작업 항목 1. DB 조회 권한만 필요하다 |
| 코드와 설정 삭제 | 작업 항목 2와 4 |
| migration 생성과 검증 | 작업 항목 3과 5. 격리 MySQL이 필요하다 |

코드 삭제와 migration 생성은 같은 브랜치에서 순서대로 수행한다.
schema를 지우기 전에 migration을 만들면 drop 대상이 나오지 않는다.

## Rollback

배포 전이면 커밋을 되돌린다.
배포 뒤에는 migration이 이미 실행돼 주소 전환만으로 되돌릴 수 없다.
이때는 fos-blog DB backup을 복구하고 이전 image를 배포한 뒤 `STUDY_SERVICE_TOKEN`을 다시 주입한다.
빈 상태로 판정했으면 복구할 행이 없으므로 이전 image 배포와 token 재주입만으로 기존 저장을 다시 쓸 수 있다.

## 완료 조건

- 제거 직전 사전 점검이 Phase 03과 같은 판정을 냈다.
- 삭제 대상 파일이 모두 없고 남은 코드에 참조가 0건이다.
- 새 forward migration이 13개 study 테이블만 지운다.
- `0012` migration과 snapshot이 그대로 남아 있다.
- 검증 절의 명령이 모두 종료 코드 0이다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `src/app/api/study/v1/**` | 삭제 |
| `src/services/study/**` | 삭제 |
| `src/infra/db/repositories/StudyRepository.ts` | 삭제 |
| `src/infra/db/repositories/StudyRepository.test.ts` | 삭제 |
| `src/infra/db/repositories/StudyImportRepository.ts` | 삭제 |
| `src/infra/db/repositories/index.ts` | study export와 factory 항목 삭제 |
| `src/infra/db/schema/study.ts` | 삭제 |
| `src/infra/db/schema/study.test.ts` | 삭제 |
| `src/infra/db/schema/index.ts` | study export 삭제 |
| `src/lib/study/auth.ts`, `src/lib/study/auth.test.ts` | 삭제 |
| `src/lib/study/http.ts`, `src/lib/study/http.test.ts` | 삭제 |
| `src/lib/study/request-hash.ts` | 삭제 |
| `src/lib/study/url-identity.ts`, `src/lib/study/url-identity.test.ts` | 삭제 |
| `src/lib/study/contracts.ts`, `src/lib/study/contracts.test.ts` | producer 전용 스키마만 삭제 |
| `src/env.ts` | inbound token 삭제 |
| `.env.example` | inbound token 예시 삭제 |
| `next.config.ts` | study API header 대상 삭제 |
| `drizzle/0012_tired_luminals.sql` | 변경 없이 보존 |
| `drizzle/meta/0012_snapshot.json` | 변경 없이 보존 |
| 새 `drizzle/0013_*.sql`과 snapshot | 13개 테이블 제거 migration 신규 |
| `drizzle/meta/_journal.json` | 생성 도구가 추가하는 항목만 반영 |
| `src/infra/db/study-removal.test.ts` | 신규 |
| `tasks/plan065-career-study-store-migration/preflight-result.md` | 재확인 결과 절 추가 |
