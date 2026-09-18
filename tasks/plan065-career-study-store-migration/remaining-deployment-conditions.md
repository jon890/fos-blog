# 남은 배포 선행 조건

fos-blog 저장소 안에서 할 수 있는 구현은 끝났다.
운영 배포, 호출 주소 전환과 token 생성은 아직 수행하지 않았다.

홈서버 DB의 13개 `study_` 테이블 제거는 2026-09-18에 끝났다.
사전 점검, backup, migration 적용과 검증 기록은 `production-db-removal-record.md`가 소유한다.

이전 기준 문서였던 `docs/study-store-migration.md`는 지웠다.
결정과 근거는 `docs/adr/039-career-study-backend-ownership.md`가, 계약은 `docs/api/study-library.md`가 소유한다.
남은 절차는 이 파일이 소유한다.

## career-os Backend

career-os의 14개 HTTP 동작이 아직 구현되지 않았다.
그래서 fos-blog의 소비측 검증은 운영 Backend 호출 대신
계약대로 응답하는 mock HTTP server로만 수행했다.

| 확인할 것 | 근거 |
| --- | --- |
| 14개 동작과 요청·응답 DTO, 상태 코드, 멱등 키 | `docs/api/study-library.md` |
| 13개 테이블의 저장, 트랜잭션, 멱등과 충돌 | `docs/api/study-library.md`와 career-os 저장 테스트 |
| `producer`가 개인 상태 수정과 가져오기 확정을 403으로 거절 | `docs/api/study-library.md`의 인증 계약 |
| `admin-gateway`가 수집과 추천 생성을 403으로 거절 | 같은 절 |
| career-os 호환 fixture 이관 | `src/lib/study/__fixtures__/career-os-plan115.ts` |

## 환경과 배포 순서

| 항목 | 확인할 것 |
| --- | --- |
| `CAREER_STUDY_BACKEND_URL` | 운영 Backend의 HTTPS base URL |
| `CAREER_STUDY_BACKEND_TOKEN` | `admin-gateway` 권한 token. producer token과 다른 값 |
| career-os producer 환경 | `STUDY_LIBRARY_URL`과 producer token |
| 2단계 image | 로컬 `/api/study/v1`과 study 테이블이 살아 있는 커밋에서 빌드 |
| 5단계 image | 그것을 지운 커밋에서 빌드. 호출 전환 검증 뒤에만 배포 |

Docker 컨테이너는 `node migrate.js && node server.js`로 서버보다 먼저 migration을 실행한다.
5단계 image가 배포되는 순간 fos-blog의 로컬 저장은 되돌릴 수 없다.

## 사전 점검과 cutover

| 단계 | 확인할 것 | 상태 |
| --- | --- | --- |
| 사전 점검 | 13개 테이블 존재 여부, `0012_tired_luminals` 적용 여부, 기존 endpoint 접근 기록 | 2026-09-18 완료 |
| 판정 기록 | `**판정**: 빈 상태` 또는 `**판정**: 데이터 있음` 한 줄과 근거 | 빈 상태로 기록 |
| 데이터 있음 경로 | snapshot 이관, 행 수와 key hash와 외래 키 검증, 합의한 관찰 기간 | 해당 없음 |
| 호출 전환 | career-os와 fos-blog가 모두 새 Backend를 가리킴 | 남음 |
| rollback | 주소 복귀 경로를 한 번 실행해 동작 확인 | 남음 |

기존 endpoint 접근 기록은 2단계 image를 배포한 기간에만 쌓인다.
5단계 커밋이 그 기록을 남기는 함수를 route와 함께 지우기 때문이다.
2단계 image를 운영에 배포한 적이 없어, 사용 여부는 로그 대신 테이블 상태로 판정했다.
13개 테이블의 행이 0이고 auto increment 다음 값이 1이어서 쓰기가 한 번도 없었다.

### 호출 전환 전에 확인할 것

빈 상태로 판정했으므로 행 수와 key hash 비교는 하지 않는다.
아래 다섯 가지는 판정과 무관하게 확인한다.

| 확인할 것 |
| --- |
| 같은 fixture로 fos-blog 기존 API와 새 Backend의 정상 응답과 오류 code가 같다 |
| 관리자 자료 조회, 상태 수정, 추천 상세와 가져오기 미리보기 및 확정이 Server Action을 통해 동작한다 |
| career-os의 소스 조회, 빈 수집, 후보 조회, 빈 추천 run과 게시 영수증이 동작한다 |
| producer token으로 개인 상태 수정과 가져오기 확정이 403이다 |
| admin-gateway token으로 수집과 추천 생성이 403이다 |

확인이 끝나면 career-os의 `STUDY_LIBRARY_URL`과 fos-blog의 `CAREER_STUDY_BACKEND_URL`을 새 Backend로 바꾼다.

### rollback

자료 손실, 계약 불일치, 권한 오류 또는 계속되는 5xx가 생기면 새 쓰기를 먼저 중지한다.

운영 DB에서 13개 테이블을 이미 지웠으므로 rollback은 주소 복귀만으로 끝나지 않는다.
fos-blog 저장으로 되돌리려면 backup을 복원해야 한다.
복원 경로와 명령은 `production-db-removal-record.md`가 소유한다.

Backend에 cutover 이후의 새 행이 있으면 그것을 먼저 추출해 복원한 fos-blog 저장에 반영한다.
dual-write는 rollback 수단으로 쓰지 않는다.
양쪽에 동시에 쓴 결과를 합치는 대신 쓰기를 멈추고 한쪽 snapshot을 다른 쪽에 반영한다.

## 이 branch가 검증한 것

| 검증 | 방법 |
| --- | --- |
| Backend client의 URL 결합, timeout, 오류 code 전달, token 비노출 | `src/lib/study/backend-client.test.ts` |
| 계약 호환 | `src/lib/study/backend-contract.test.ts`의 mock HTTP server |
| Server Action의 세션과 Origin 판정 | `src/app/admin/study-backend-actions.test.ts` |
| 관리자 화면의 조회, 상태 충돌 복구, 가져오기 | `src/components/study/`와 `src/app/admin/`의 테스트 |
| 제거 migration이 13개 테이블만 지움 | `src/infra/db/study-removal.test.ts`. 격리 MySQL에서 실행 |
