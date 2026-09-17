# Phase 01. career-os Backend 계약 준비와 통과 기록

**Execution profile**: deep

## 목표

career-os Backend가 학습자료 데이터와 14개 HTTP 동작을 소유할 수 있는 상태인지 판정하고,
뒤 phase가 읽을 통과 기록을 fos-blog 저장소에 남긴다.

**범위 외**: fos-blog의 제품 코드 변경, 관리자 화면 전환, 데이터 이관과 기존 API 삭제는 이 phase에 포함하지 않는다.
career-os Backend의 구현 자체는 career-os 저장소에서 별도 Dispatch로 수행하며 이 phase가 직접 고치지 않는다.

## 컨텍스트

현재 fos-blog가 `/api/study/v1`로 14개 동작을 제공하고 career-os가 그것을 소비한다.
career-os의 소비측 client는 `scripts/study-topic-recommender/study-library/client.ts`에 있고
`STUDY_LIBRARY_API_BASE_PATH`로 `/api/study/v1`을 사용한다.
이번 이전은 그 방향을 뒤집어 career-os가 데이터와 14개 동작을 소유하게 만든다.

fos-blog의 `docs/api/study-library.md`가 두 저장소가 공유하는 HTTP 계약의 단일 소스다.
새 Backend는 기본 경로, DTO, 상태 코드, 멱등 키, URL 정규화와 cursor 형식을 바꾸지 않는다.
인증만 브라우저 세션 대신 역할이 구분된 서버용 Bearer로 바꾼다.

이 phase는 fos-blog 저장소에서 실행하며 career-os 저장소를 수정하지 않는다.
career-os 구현은 이 phase가 만든 지시 문서를 받아 별도 Dispatch가 수행한다.

**근거 문서**: `docs/study-store-migration.md` 의 「실행 순서와 통과 조건」 절, `docs/api/study-library.md`

## 의도 메모

- 계약을 바꾸면서 저장소를 옮기면 실패 원인이 둘로 늘어난다. 계약은 그대로 두고 소유자만 옮긴다.
- career-os 저장소에는 `package.json`이 없어 검증 명령이 fos-blog와 다르다.
  명령을 여기서 지어내지 않고 career-os Dispatch가 자기 저장소의 명령을 기록에 적게 한다.
- 통과 기록은 `tasks/` 안에 둔다. plan이 끝나면 함께 제거되며 오래 남는 책임 문서가 아니다.
- 통과 기록에 실제 token, DB 주소와 요청 본문을 넣지 않는다.

## Blocked 조건

- `docs/api/study-library.md`의 14개 동작 표가 현재 route 구현과 다르면
  `PHASE_BLOCKED: HTTP 계약 단일 소스 불일치`를 출력하고 종료한다.
- career-os 저장소에서 실행할 Dispatch를 만들 수 없으면
  `PHASE_BLOCKED: career-os 구현 Dispatch 없음`을 출력하고 종료한다.

## 작업 항목

### 1. 이관 계약 기준 고정

`docs/api/study-library.md`의 14개 동작, 공통 규칙, DTO, 상태 코드, 멱등 키,
URL 식별과 cursor 형식을 새 Backend가 그대로 구현할 기준으로 확정한다.
이 phase에서 그 문서를 고치지 않는다. 계약 변경은 이전이 끝난 뒤 별도로 다룬다.

현재 route 구현과 대조해 표의 14개 동작이 실제 export와 같은지 확인한다.
대조 대상은 `src/app/api/study/v1/` 아래 13개 `route.ts`의 `GET`, `POST`, `PUT`, `PATCH` export다.
`recommendation-runs/route.ts`만 `GET`과 `POST`를 함께 가진다.

### 2. career-os 구현 Dispatch 지시문 작성

career-os 저장소에서 수행할 범위를 지시문으로 정리한다.
아래를 모두 담고, fos-blog 경로를 근거로 인용한다.

| 전달할 것 | 내용 |
| --- | --- |
| 저장 모델 | 13개 `study_` 테이블의 필드, 키, unique 제약과 외래 키. `src/infra/db/schema/study.ts` 기준 |
| HTTP 동작 | 14개 동작의 요청과 응답 DTO, 상태 코드, 1 MiB 본문 제한, `{error:{code,message,requestId}}` 오류 형태 |
| 원자성 | 자료, 소스 연결, cursor와 영수증을 한 트랜잭션으로 저장. 같은 멱등 키 재전송은 기존 영수증을 먼저 반환 |
| 재시도 | deadlock 재시도. `src/services/study/deadlock-retry.ts`가 현재 계약 |
| 역할 구분 | `producer`는 수집과 추천 쓰기만, `admin-gateway`는 조회와 개인 상태 수정과 import commit만 |
| 호환 fixture | `src/app/api/study/v1/__fixtures__/career-os-plan115.ts`를 Backend 저장소로 옮겨 회귀 기준으로 사용 |

`producer` token으로 개인 상태 수정과 import commit을 403으로 거절하고,
`admin-gateway` token으로 수집과 추천 생성을 403으로 거절하는 조건을 함께 전달한다.

### 3. 통과 기록 파일 작성

`tasks/plan065-career-study-store-migration/backend-readiness.md`를 만든다.
career-os Dispatch가 보고한 결과를 비밀값 없이 옮겨 적는다.

문서는 아래 절을 모두 가진다.

- `## 14개 HTTP 동작` — 동작마다 한 행. 각 행은 `` | `METHOD /경로` `` 로 시작하고 구현 상태와 테스트 이름을 적는다
- `## 계약 테스트 결과` — career-os 저장소에서 실행한 명령과 결과
- `## 저장 테스트 결과` — 13개 테이블의 트랜잭션, 멱등과 충돌 검증 결과
- `## 역할별 인증 결과` — producer와 admin-gateway가 서로의 동작을 403으로 거절한 결과
- `## Backend 주소와 token 주입 방법` — 환경 변수 이름과 주입 위치. 실제 값은 적지 않는다

Backend는 이 시점에 production 요청을 아직 받지 않는 상태로 배포한다.

### 4. 통과 기록과 계약 대조 테스트

통과 기록이 14개 동작을 빠짐없이 담았고 필수 절이 모두 있는지 검사한다.
기록에 Bearer token, DB 주소나 요청 본문이 들어가지 않았는지 함께 검사한다.
검사는 아래 검증 절의 명령으로 수행하며 모두 종료 코드 0이어야 한다.

## 검증

fos-blog worktree에서 실행한다.
career-os 저장소의 명령은 그 저장소 Dispatch가 실행하고 결과만 통과 기록에 남긴다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
test -f tasks/plan065-career-study-store-migration/backend-readiness.md
test "$(grep -cE '^\| `(GET|POST|PUT|PATCH) ' tasks/plan065-career-study-store-migration/backend-readiness.md)" = "14"
test "$(grep -hoE 'export (async )?function (GET|POST|PUT|PATCH|DELETE)' $(find src/app/api/study/v1 -name route.ts) | wc -l | tr -d ' ')" = "14"
for s in '## 14개 HTTP 동작' '## 계약 테스트 결과' '## 저장 테스트 결과' '## 역할별 인증 결과' '## Backend 주소와 token 주입 방법'; do grep -qF "$s" tasks/plan065-career-study-store-migration/backend-readiness.md || exit 1; done
! grep -nE 'Bearer [A-Za-z0-9._-]{8,}|mysql://|DATABASE_URL=' tasks/plan065-career-study-store-migration/backend-readiness.md
/Users/nhn/personal/fos-skills/korean-check/scripts/check.sh tasks/plan065-career-study-store-migration/backend-readiness.md
git diff --check
```

제품 코드를 바꾸지 않으므로 `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`는 이 phase의 통과 조건이 아니다.

## 후속 Dispatch 단위

| Dispatch | 저장소 | 넘길 것 |
| --- | --- | --- |
| career-os Backend 구현 | career-os | 작업 항목 2의 지시문, `docs/api/study-library.md` 사본, 13개 테이블 정의 |
| 통과 기록 정리 | fos-blog | career-os Dispatch의 보고와 이 phase의 통과 기록 형식 |

## Rollback

이 phase는 fos-blog 제품 코드와 운영 환경을 바꾸지 않는다.
되돌릴 때는 통과 기록 파일을 지우고 career-os Dispatch를 취소한다.
career-os Backend를 이미 배포했으면 production 요청을 받지 않는 상태이므로 그대로 두고 다음 시도에 재사용한다.

## 완료 조건

- 통과 기록의 14개 동작이 현재 route 구현의 14개 동작과 같다.
- 계약, 저장, 역할별 인증 테스트 결과가 모두 통과로 기록됐다.
- 기록에 실제 token, DB 주소와 요청 본문이 없다.
- Backend 주소와 token 주입 방법이 이름 수준으로 정해졌다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `tasks/plan065-career-study-store-migration/backend-readiness.md` | 신규 |
| `docs/api/study-library.md` | 변경 없이 계약 기준으로 인용 |
| `src/app/api/study/v1/**` | 변경 없이 14개 동작 대조 대상 |
| `src/infra/db/schema/study.ts` | 변경 없이 저장 모델 기준 |
