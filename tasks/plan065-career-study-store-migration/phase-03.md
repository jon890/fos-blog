# Phase 03. 사전 점검 판정과 단일 writer 호출 전환

**Execution profile**: deep

## 목표

cutover 직전에 fos-blog의 study 데이터와 사용 내역을 읽기 전용으로 판정하고,
producer와 관리자 화면의 단일 writer를 career-os Backend로 바꾼다.

**범위 외**: snapshot 이관과 행 검증은 Phase 04가, 기존 API와 테이블 삭제는 Phase 05가 맡는다.
이 phase는 fos-blog의 제품 코드를 바꾸지 않는다.

## 컨텍스트

dual-write를 사용하지 않는다.
career-os job과 fos-blog 관리자 쓰기를 중지한 뒤 두 호출자의 주소를 새 Backend로 바꾼다.

2026-09-17 조사에서는 이 worktree의 공유 `.env`가 가리키는 DB에 13개 `study_` 테이블이 없었고
`0012_tired_luminals`도 `__drizzle_migrations`에 적용되지 않았다.
그 결과는 배포 직전 상태를 보장하지 않으므로 이 phase에서 같은 조회를 다시 수행한다.

사전 점검의 판정이 뒤 phase의 경로를 정한다.
빈 상태면 Phase 04를 생략하고, 데이터 있음이면 Phase 04를 수행한다.

Phase 02가 `authorizeStudyRequest`에 접근 기록을 추가했으므로 기존 endpoint 사용 여부를 로그로 판정할 수 있다.

**근거 문서**: `docs/study-store-migration.md` 의 「데이터 이관 순서」 절

## 의도 메모

- 자격증명, 원문 메모, 요청 본문과 DB 주소는 결과 문서와 터미널 출력에 남기지 않는다.
- 행이 없어도 Backend의 schema 적용, 역할별 인증과 14개 API smoke test는 수행한다.
- 판정이 애매하면 데이터 있음으로 처리한다. 잘못 빈 상태로 판정하면 되돌릴 원본 없이 제거로 넘어간다.
- 기존 fos-blog 테이블과 API는 이 phase에서 지우지 않고 읽기 전용 rollback 원본으로 남긴다.

## 선행 의존과 배포 조건

| 항목 | 조건 |
| --- | --- |
| 시작 조건 | Phase 01 통과 기록이 있고, Phase 02 image가 배포 가능한 상태 |
| 배포 조건 | Phase 02 image를 Backend 주소와 `admin-gateway` token이 주입된 환경에 배포한다 |
| 금지 | study 테이블을 drop하는 image는 이 phase에서 배포하지 않는다 |

## Blocked 조건

- `tasks/plan065-career-study-store-migration/backend-readiness.md`가 없으면
  `PHASE_BLOCKED: career-os Backend 계약 미완료`를 출력하고 종료한다.
- Backend backup과 restore가 검증되지 않았으면 `PHASE_BLOCKED: Backend 복구 검증 없음`을 출력하고 종료한다.
- producer와 관리자 쓰기를 모두 중지할 수 없으면 `PHASE_BLOCKED: 단일 writer 전환 불가`를 출력하고 종료한다.
- 사전 점검이 데이터 있음으로 판정했는데 fos-blog DB backup이 없으면
  `PHASE_BLOCKED: fos-blog DB backup 없음`을 출력하고 종료한다.

## 작업 항목

### 1. 읽기 전용 사전 점검과 쓰기 중지

공유 `.env`의 비밀값을 출력하지 않고 fos-blog DB에 읽기 전용 세션으로 접속한다.
`SET SESSION TRANSACTION READ ONLY`와 일관된 snapshot을 사용한다.

아래를 조회해 기록한다.

| 조회 대상 | 판정에 쓰는 값 |
| --- | --- |
| `information_schema.tables`의 `study_%` | 13개 테이블 존재 여부 |
| `__drizzle_migrations` | `0012_tired_luminals` 적용 여부 |
| 존재하는 `study_` 테이블 | 표별 정확한 행 수, 최대 auto increment ID, 외래 키 누락 수 |
| 운영 컨테이너 로그 | Phase 02가 추가한 기존 endpoint 접근 기록 |
| career-os job 실행 기록 | 최근 실행 시각과 호출 대상 주소 |

career-os 수집과 추천 job을 중지하고 fos-blog 관리자 상태 수정과 import commit을 maintenance 상태로 바꾼다.
중지 뒤 같은 조회를 한 번 더 수행해 행 수와 version이 변하지 않는지 비교한다.

### 2. 경로 판정 기록

사전 점검 결과로 아래 둘 중 하나를 판정하고
`tasks/plan065-career-study-store-migration/preflight-result.md`에 남긴다.

| 판정 | 조건 | 이어지는 처리 |
| --- | --- | --- |
| 빈 상태 | 13개 테이블이 모두 없고 `0012_tired_luminals`가 미적용이며 endpoint와 producer 사용 내역이 없다 | Phase 04를 생략하고 Phase 05로 간다 |
| 데이터 있음 | 테이블, 행 또는 사용 내역이 하나라도 있다 | Phase 04를 수행한다 |

기록에는 조회 시각, 조회 대상, 결과와 판정 근거를 적는다.
DB 주소, 자격증명과 메모 원문은 적지 않는다.
테이블이 없어서 행 수를 셀 수 없으면 `0`이 아니라 `해당 없음`으로 적는다.

### 3. 호출 주소와 역할별 token 전환

career-os producer의 `STUDY_LIBRARY_URL`을 새 Backend로 바꾸고 producer token을 주입한다.
fos-blog에 `CAREER_STUDY_BACKEND_URL`과 `admin-gateway` token을 주입한 Phase 02 image를 배포한다.

두 token은 서로 다른 값이며 같은 값을 재사용하지 않는다.
fos-blog 서버에는 producer token을 주입하지 않는다.

`STUDY_SERVICE_TOKEN`은 이 phase에서 폐기하지 않는다.
rollback으로 주소를 되돌리면 career-os가 다시 그 token으로 fos-blog를 호출한다.

### 4. cutover 계약과 rollback 테스트

career-os에서 소스 조회, 빈 ingestion, 후보 조회, 빈 추천 run과 게시 이력 기록을 실행한다.
fos-blog 관리자 화면에서 자료 조회, 상태 수정, 추천 상세, import dry-run과 commit을 실행한다.

권한 경계를 양쪽 방향으로 확인한다.

| 검사 | 기대 결과 |
| --- | --- |
| producer token으로 개인 상태 수정과 import commit | 403 |
| admin-gateway token으로 ingestion과 추천 생성 | 403 |
| 관리자 세션 없이 Server Action 호출 | 거절 |
| 같은 멱등 키 재시도 | 기존 영수증 응답 |
| 오래된 version으로 상태 수정 | 409 |
| 없는 자료 조회 | 404 |
| Backend 응답 지연과 503 | 기존 오류 code로 전달 |

테스트로 만든 행은 별도 식별자를 사용하고 검증 뒤 외래 키 역순으로 정리한다.
주소 복귀와 쓰기 중지 절차를 한 번 실행해 rollback 경로가 동작하는지 검증한 다음 새 Backend 주소로 다시 전환한다.

## 검증

운영 비밀값을 인자나 출력에 포함하지 않는다.
저장소 검증과 배포 smoke 결과가 모두 성공해야 한다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
test -f tasks/plan065-career-study-store-migration/preflight-result.md
grep -qE '^\*\*판정\*\*: (빈 상태|데이터 있음)$' tasks/plan065-career-study-store-migration/preflight-result.md
! grep -nE 'mysql://|DATABASE_URL=|Bearer [A-Za-z0-9._-]{8,}' tasks/plan065-career-study-store-migration/preflight-result.md
/Users/nhn/personal/fos-skills/korean-check/scripts/check.sh tasks/plan065-career-study-store-migration/preflight-result.md
pnpm exec vitest run 'src/lib/study/backend-client.test.ts' 'src/app/admin/study-backend-actions.test.ts' 'src/app/admin/study-workflow.test.tsx'
pnpm lint
pnpm type-check
pnpm test
pnpm build
git diff --check
```

판정 기록은 `**판정**: 빈 상태` 또는 `**판정**: 데이터 있음` 한 줄을 포함한다.
전환 시각, 권한 경계 검사 결과와 rollback 검증 결과는 비밀값 없이 같은 기록에 남긴다.

## 후속 Dispatch 단위

| Dispatch | 범위 |
| --- | --- |
| 읽기 전용 사전 점검 | 작업 항목 1과 2. DB 조회 권한만 필요하다 |
| 주소 전환과 계약 검증 | 작업 항목 3과 4. 운영 환경 변경 권한이 필요하다 |

두 Dispatch는 순서가 있다. 판정 기록 없이 주소를 바꾸면 되돌릴 근거가 남지 않는다.

## Rollback

새 쓰기를 먼저 중지한다.
Backend에 cutover 이후 새 행이 없으면 두 호출자의 주소를 fos-blog로 되돌리고 기존 writer를 재개한다.
새 행이 있으면 Backend snapshot에서 cutover 이후의 ID, version과 영수증을 추출해 fos-blog에 reverse import한 뒤 주소를 되돌린다.

빈 상태 판정에서는 fos-blog에 되돌릴 원본이 없다.
이때의 rollback은 주소를 되돌려 fos-blog 저장으로 다시 쓰기를 시작하는 것이며,
Phase 05 전에는 그 저장이 그대로 남아 있으므로 주소 전환만으로 충분하다.

## 완료 조건

- 사전 점검 판정과 근거가 비밀값 없이 기록됐다.
- career-os와 fos-blog의 호출 주소가 모두 새 Backend를 가리킨다.
- producer와 admin-gateway가 서로의 동작을 403으로 거절한다.
- 관리자 화면의 다섯 흐름과 career-os의 다섯 흐름이 새 Backend에서 동작한다.
- rollback 경로를 한 번 실행해 동작을 확인했다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `tasks/plan065-career-study-store-migration/preflight-result.md` | 신규 |
| fos-blog 운영 환경 설정 | Backend URL과 admin-gateway token 주입 |
| career-os 운영 환경 설정 | Backend URL과 producer token 주입 |
| `docs/study-store-migration.md` | 판정 방법이 바뀌었을 때만 수정. 행 수와 비밀값은 넣지 않는다 |
