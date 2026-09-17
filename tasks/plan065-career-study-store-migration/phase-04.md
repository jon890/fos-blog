# Phase 04. (조건부) snapshot 이관과 행 검증, 관찰

**Execution profile**: deep

## 목표

Phase 03이 데이터 있음으로 판정했을 때만 실행한다.
쓰기 중지 구간에서 fos-blog의 study 데이터를 career-os Backend로 옮기고,
행과 계약이 같은지 검증한 뒤 합의한 기간 동안 기존 저장이 쓰이지 않는지 관찰한다.

**범위 외**: fos-blog의 기존 API, 테이블, migration 이력과 rollback 원본 삭제는 Phase 05가 맡는다.
career-os Backend의 내부 스키마 최적화도 포함하지 않는다.

## 컨텍스트

Phase 03의 `tasks/plan065-career-study-store-migration/preflight-result.md`가 이 phase의 실행 여부를 정한다.
`**판정**: 빈 상태`면 옮길 행과 되돌릴 원본이 없으므로 이 phase를 실행하지 않는다.
`**판정**: 데이터 있음`이면 아래를 모두 수행한다.

옮길 때 auto increment ID를 새로 만들지 않고 원래 값을 보존한다.
`study_recommendation_control.latest_run_id`, 추천 item의 세 외래 키와
누적 추천의 `first_run_id`가 원래 대상을 가리켜야 하기 때문이다.

**근거 문서**: `docs/study-store-migration.md` 의 「snapshot과 import」 절

## 의도 메모

- dual-write를 쓰지 않는다. 양쪽에 동시에 쓴 결과를 합치는 대신 쓰기를 멈추고 한쪽 snapshot을 반영한다.
- `owner_key`는 현재 한 명만 사용해도 초기 이관에서 유지한다.
  없애면 상태와 추천 제어 키를 동시에 바꾸고 rollback 변환도 추가해야 한다.
- 관찰 기간의 길이는 사용자가 정한다. 고정 7일 조건은 사용자 결정으로 제거했다.
- 불일치가 하나라도 있으면 주소를 바꾸지 않고 Backend 데이터를 초기화한 뒤 원인을 고친다.

## 선행 의존과 생략 조건

| 항목 | 조건 |
| --- | --- |
| 시작 조건 | Phase 03의 판정 기록이 `**판정**: 데이터 있음` |
| 생략 조건 | 판정 기록이 `**판정**: 빈 상태`. 이때 이 phase를 실행하지 않고 `index.json`의 `current_phase`를 `5`로 올린다 |
| 생략 근거 | 판정 기록 자체가 근거다. 별도 문서를 만들지 않는다 |
| 배포 조건 | study 테이블을 drop하는 image는 이 phase에서 배포하지 않는다 |

## Blocked 조건

- 판정 기록이 없으면 `PHASE_BLOCKED: 사전 점검 판정 없음`을 출력하고 종료한다.
- 판정이 `빈 상태`면 `PHASE_SKIPPED: 빈 상태 판정으로 데이터 이관 생략`을 출력하고 종료한다.
- fos-blog DB backup이 없으면 `PHASE_BLOCKED: fos-blog DB backup 없음`을 출력하고 종료한다.
- Backend backup과 restore가 검증되지 않았으면 `PHASE_BLOCKED: Backend 복구 검증 없음`을 출력하고 종료한다.

## 작업 항목

### 1. 일관된 snapshot export

쓰기를 중지한 상태에서 하나의 일관된 snapshot을 만들고 아래 순서로 내보낸다.
외래 키가 모두 `RESTRICT`라서 부모부터 넣어야 한다.

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

PK, 외래 키와 auto increment ID를 그대로 보존한다.

### 2. Backend import와 행 검증

같은 순서로 Backend에 가져온다.
가져온 뒤 각 auto increment의 다음 값이 이관한 최대 ID보다 큰지 확인한다.

원본과 대상에서 아래를 비교한다.

| 비교 대상 | 기대 |
| --- | --- |
| 13개 표별 행 수 | 같다 |
| PK와 unique key를 정렬해 계산한 표별 hash | 같다 |
| 외래 키 누락 수 | 양쪽 모두 0 |
| cursor version, 상태 version, `history_version`, `latest_run_id` | 같다 |
| 같은 멱등 키의 저장된 응답 | 같다 |

하나라도 다르면 주소를 바꾸지 않고 Backend 데이터를 초기화한 뒤 원인을 고친다.

### 3. 관찰과 사용 내역 판정

합의한 기간 동안 기존 저장이 쓰이지 않는지 확인한다.

| 확인할 것 | 방법 | 기대 |
| --- | --- | --- |
| 기존 endpoint 접근 | 운영 컨테이너 로그에서 Phase 02가 추가한 접근 기록을 조회한다 | 0건 |
| 기존 테이블 쓰기 | 13개 표의 행 수, 최대 auto increment와 최신 `updated_at`을 기간 시작과 끝에 조회해 비교한다 | 변화 없음 |
| producer 호출 대상 | career-os job의 실행 기록에서 호출 주소를 조회한다 | 새 Backend만 |

관찰 결과를 `tasks/plan065-career-study-store-migration/observation-result.md`에 비밀값 없이 남긴다.
접근이나 쓰기가 한 번이라도 있으면 원인을 찾아 그 호출자를 새 Backend로 옮기고 기간을 다시 시작한다.

### 4. 이관 결과와 계약 회귀 테스트

같은 fixture로 fos-blog 기존 API와 새 Backend의 정상 응답과 오류 code가 같은지 확인한다.
`src/app/api/study/v1/__fixtures__/career-os-plan115.ts`의 YouTube URL 식별,
기존 이력 변환과 nullable 설명 필드가 양쪽에서 같은 결과를 내는지 확인한다.

저장소 테스트로 Backend client와 Server Action의 회귀가 없는지 확인한다.
검증 절의 명령이 모두 종료 코드 0이어야 이 phase가 끝난다.

## 검증

운영 비밀값을 인자나 출력에 포함하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
grep -qE '^\*\*판정\*\*: 데이터 있음$' tasks/plan065-career-study-store-migration/preflight-result.md
test -f tasks/plan065-career-study-store-migration/observation-result.md
! grep -nE 'mysql://|DATABASE_URL=|Bearer [A-Za-z0-9._-]{8,}' tasks/plan065-career-study-store-migration/observation-result.md
/Users/nhn/personal/fos-skills/korean-check/scripts/check.sh tasks/plan065-career-study-store-migration/observation-result.md
pnpm exec vitest run 'src/lib/study/backend-client.test.ts' 'src/app/admin/study-backend-actions.test.ts' 'src/app/admin/study-workflow.test.tsx'
pnpm lint
pnpm type-check
pnpm test
pnpm build
git diff --check
```

관찰 기록은 기간 시작과 끝의 조회 결과, 접근 기록 건수와 producer 호출 대상을 담는다.

## 후속 Dispatch 단위

| Dispatch | 범위 |
| --- | --- |
| snapshot export와 import | 작업 항목 1과 2. 양쪽 DB 접근 권한이 필요하다 |
| 관찰과 기록 | 작업 항목 3. 읽기 권한과 로그 조회 권한만 필요하다 |
| 계약 회귀 검증 | 작업 항목 4. fos-blog worktree에서 수행한다 |

## Rollback

이관 중 불일치가 나오면 Backend 데이터를 초기화하고 주소를 바꾸지 않는다.
이미 주소를 바꾼 뒤라면 새 쓰기를 중지하고 Backend snapshot에서 cutover 이후의 ID, version과 영수증을 추출해
fos-blog에 reverse import한 뒤 13개 행 수, key hash와 외래 키를 다시 확인하고 주소를 되돌린다.

## 완료 조건

- 13개 표의 행 수, key hash와 외래 키 검증이 모두 일치한다.
- auto increment의 다음 값이 이관한 최대 ID보다 크다.
- 관찰 기간 동안 기존 endpoint 접근과 기존 테이블 쓰기가 0건이다.
- 계약 회귀 테스트가 통과했다.
- 검증 기록이 비밀값 없이 남았다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `tasks/plan065-career-study-store-migration/observation-result.md` | 신규 |
| `tasks/plan065-career-study-store-migration/preflight-result.md` | 읽기만 한다 |
| `src/app/api/study/v1/__fixtures__/career-os-plan115.ts` | 변경 없이 회귀 기준으로 사용 |
| fos-blog와 Backend DB | snapshot export와 import |
