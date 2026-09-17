# Phase 02. 관리자 화면을 서버 전용 Backend client로 전환

**Execution profile**: deep

## 목표

fos-blog 관리자 화면이 로컬 Repository와 `/api/study/v1` 대신 career-os Backend를 서버에서 호출하게 만들고,
기존 endpoint 접근을 판정할 수 있는 기록을 남긴다.

**범위 외**: career-os Backend 구현, 운영 데이터 이관, 기존 Route Handler와 study 테이블 삭제는 이 phase에 포함하지 않는다.

## 컨텍스트

Phase 01이 career-os Backend의 14개 HTTP 동작과 역할별 인증 통과를 기록한 뒤에 시작한다.
Backend는 기존 `/api/study/v1`의 DTO, 상태 코드, 멱등 키와 cursor 계약을 그대로 구현한다.

fos-blog는 Better Auth와 관리자 화면을 유지한다.
브라우저가 Backend token을 보거나 새 Backend를 직접 호출해서는 안 된다.
기존 API와 Repository는 cutover 검증이 끝날 때까지 남겨 두지만 새 코드에서 양쪽에 동시에 쓰지 않는다.

현재 관리자 화면의 호출 구조는 아래와 같다.

| 위치 | 현재 호출 |
| --- | --- |
| `src/app/admin/(protected)/study/page.tsx` | `requireAdminPage()` 뒤 `StudyLibrary` 렌더 |
| `src/app/admin/(protected)/study/imports/page.tsx` | `requireAdminPage()` 뒤 `ImportPanel` 렌더 |
| `src/app/admin/(protected)/study/recommendations/page.tsx` | `requireAdminPage()` 뒤 `RecommendationHistory` 렌더 |
| `src/app/admin/(protected)/study/recommendations/[reportId]/page.tsx` | `requireAdminPage()` 뒤 `getRecommendationRun`을 직접 호출 |
| `src/components/study/StudyLibrary.tsx` | `/api/study/v1/materials`, `/sources`, `/materials/{id}`, `/materials/{id}/state` |
| `src/components/study/RecommendationReport.tsx` | `/api/study/v1/recommendation-runs/{reportId}`, `/materials/{id}`, `/materials/{id}/state` |
| `src/components/study/RecommendationHistory.tsx` | `/api/study/v1/recommendation-runs` |
| `src/components/study/ImportPanel.tsx` | `/api/study/v1/imports/dry-run`, `/imports/commit` |

서비스를 직접 부르는 server component는 추천 상세 page 하나뿐이다.

**근거 문서**: `docs/study-store-migration.md` 의 「관리자 화면」 절, `docs/api/study-library.md`

## 의도 메모

- 기존 `fetch`, Zod와 Server Action을 사용하고 새 HTTP client 의존성을 추가하지 않는다.
- `producer`와 `admin-gateway` token은 분리하며 fos-blog에는 `admin-gateway` token만 둔다.
- phase 결과는 Backend 설정이 준비된 배포에서 한 번에 활성화한다. 로컬 DB fallback과 dual-write 분기는 만들지 않는다.
- 기존 endpoint 접근 기록은 route마다 넣지 않고 14개 route가 모두 거치는 `authorizeStudyRequest` 한 곳에 넣는다.
  현재 구현은 오류만 로그로 남겨서 성공한 요청의 흔적이 없고, 그대로 두면 사용 여부를 판정할 근거가 생기지 않는다.

## 선행 의존과 배포 조건

| 항목 | 조건 |
| --- | --- |
| 시작 조건 | `tasks/plan065-career-study-store-migration/backend-readiness.md`의 14개 동작과 역할별 인증이 모두 통과로 기록됨 |
| 배포 조건 | Backend 주소와 `admin-gateway` token이 운영 환경에 주입된 뒤에만 이 phase의 image를 배포한다 |
| 배포 전 상태 | Backend 설정이 없는 환경에 배포하면 관리자 학습자료 화면이 전부 실패한다 |

## Blocked 조건

- `backend-readiness.md`가 없거나 14개 동작이 모두 통과로 기록되지 않았으면
  `PHASE_BLOCKED: career-os Backend 계약 미완료`를 출력하고 종료한다.
- 격리된 Backend 테스트 주소와 가짜 `admin-gateway` token이 없으면
  `PHASE_BLOCKED: Backend client 검증 환경 없음`을 출력하고 종료한다.

## 작업 항목

### 1. 환경 계약과 서버 전용 HTTP client 추가

`src/env.ts`의 `server` 블록과 `runtimeEnv`, 그리고 `.env.example`에
`CAREER_STUDY_BACKEND_URL`과 `CAREER_STUDY_BACKEND_TOKEN`을 추가한다.
둘 다 `z.string().optional()` 대신 값이 있을 때 형식을 검사하는 스키마로 둔다.
운영 URL은 HTTPS만 허용하고 개발과 테스트에서는 loopback HTTP만 허용한다.
`STUDY_SERVICE_TOKEN`은 이 phase에서 지우지 않는다. 기존 API가 아직 살아 있다.

`src/lib/study/backend-client.ts`를 추가한다.
base URL에 기존 `/api/study/v1` 상대 경로를 결합하고, Bearer token과 JSON 헤더를 서버에서만 붙인다.
응답 timeout, JSON 파싱 실패, 기존 오류 envelope와 401, 403, 404, 409, 413, 429, 503을 구분한다.
요청 URL, token, 메모와 import 본문을 로그에 넣지 않는다.
`"server-only"` import로 브라우저 번들 유입을 막는다.

### 2. 관리자 세션 Server Action 추가

`src/app/admin/(protected)/study/actions.ts`에 관리자 화면이 사용하는 조회와 쓰기 action을 추가한다.
각 action은 `src/lib/admin/session.ts`의 `getAdminSession`으로 세션과 허용 계정을 확인한 뒤 Backend client를 호출한다.
page가 쓰는 `requireAdminPage()`는 실패할 때 redirect하므로 action에서는 쓰지 않고,
`getAdminSession`의 `unauthenticated`, `forbidden`, `unavailable` 결과를 action 결과로 변환한다.

자료 목록과 단건, 소스 목록, 개인 상태 수정, 추천 목록과 상세, import dry-run과 commit을 제공한다.
상태 수정과 import commit은 기존 Origin과 관리자 권한 조건을 유지한다.
action 결과는 현재 component가 구분하는 성공, 인증 만료, version 충돌, not found와 일시 장애 형태로 제한한다.

### 3. 관리자 page와 component 호출부 변경

`src/app/admin/(protected)/study/recommendations/[reportId]/page.tsx`의
`getRecommendationRun` 직접 호출을 Backend client 호출로 바꾸고 404 판정은 그대로 유지한다.
네 page가 client component에 action을 props로 넘기도록 고친다.

`src/components/study/StudyLibrary.tsx`, `RecommendationReport.tsx`,
`RecommendationHistory.tsx`, `ImportPanel.tsx`의 `/api/study/v1` 상대 fetch를 제거하고
page에서 받은 action props를 사용한다.

느린 이전 응답 무시, 409 뒤 최신 상태 조회, 메모 초안 보존, import previewHash와 historyVersion 검증은 유지한다.
`src/lib/study/contracts.ts`는 관리자 UI의 요청·응답 DTO와 오류 스키마만 남기고 producer 전용 요청 스키마는 아직 삭제하지 않는다.

### 4. 기존 endpoint 접근 기록 추가

`src/lib/study/auth.ts`의 `authorizeStudyRequest`에 접근 기록 한 줄을 추가한다.
이 함수는 14개 route가 모두 부르는 단일 지점이라 route 파일을 손대지 않아도 된다.

기록에는 HTTP method, 경로와 주체 종류(`service` 또는 `admin`)만 넣는다.
token, 메모, 요청 본문과 query 값은 넣지 않는다.
level은 `info`로 두어 운영 로그에서 조회할 수 있게 한다.
이 기록은 cutover 사전 점검과 제거 단계 직전 재확인의 근거가 된다.

### 5. Backend client, Server Action과 접근 기록 테스트

`src/lib/study/backend-client.test.ts`에서 URL 결합, timeout, 잘못된 JSON,
401·403·404·409·413·429·503 오류 code 전달과 token 비노출을 검증한다.

`src/app/admin/study-backend-actions.test.ts`에서 익명, 허용하지 않은 계정,
세션 장애와 정상 action 호출을 검증한다.
`getAdminSession`의 네 결과가 각각 어떤 action 결과로 바뀌는지 확인한다.

`src/lib/study/auth.test.ts`에 접근 기록이 method, 경로와 주체 종류만 담고
token과 본문을 담지 않는 검증을 추가한다.

`src/components/study/StudyLibrary.test.tsx`, `ImportPanel.test.tsx`와
`src/app/admin/study-workflow.test.tsx`를 action props와 action mock을 쓰도록 고친다.
`study-workflow.test.tsx`는 현재 `@/services/study/recommendations`를 mock하므로 action mock으로 바꾼다.
상태 충돌과 import 변경, 느린 응답 순서가 기존 화면 동작을 바꾸지 않는지 확인한다.

## 검증

fos-blog worktree에서 실행한다.
격리 Backend는 요청 본문과 token을 저장하지 않는 fixture여야 한다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
pnpm exec vitest run 'src/lib/study/backend-client.test.ts' 'src/app/admin/study-backend-actions.test.ts' 'src/lib/study/auth.test.ts' 'src/components/study/StudyLibrary.test.tsx' 'src/components/study/ImportPanel.test.tsx' 'src/app/admin/study-workflow.test.tsx' 'src/app/admin/study-page.test.tsx'
! grep -rn 'api/study/v1' src/components/study
! grep -rn 'CAREER_STUDY_BACKEND_TOKEN' src/components
pnpm lint
pnpm type-check
pnpm test
pnpm build
! grep -rl 'CAREER_STUDY_BACKEND_TOKEN' .next/static
git diff --check
```

브라우저 번들에 token 이름과 값이 없어야 한다. 위 `.next/static` 검색이 그것을 판정한다.
모든 명령이 종료 코드 0이고 테스트 출력에 token이 없어야 phase가 끝난다.

## 후속 Dispatch 단위

| Dispatch | 범위 |
| --- | --- |
| Backend client와 환경 계약 | 작업 항목 1과 그 테스트 |
| Server Action과 화면 호출부 전환 | 작업 항목 2와 3, 그리고 화면 테스트 수정 |
| 접근 기록 추가 | 작업 항목 4와 `auth.test.ts` 보강 |

세 Dispatch를 나누면 `src/lib/study/contracts.ts`와 `src/app/admin/study-workflow.test.tsx`가 겹친다.
겹치는 파일은 앞 Dispatch가 먼저 확정하고 뒤 Dispatch가 그 결과를 받는다.

## Rollback

배포 전이면 커밋을 되돌린다.
배포 뒤 관리자 화면이 실패하면 이전 image로 되돌린다.
이전 image는 로컬 `/api/study/v1`을 그대로 쓰므로 데이터 복구가 필요하지 않다.
`CAREER_STUDY_BACKEND_URL`과 `CAREER_STUDY_BACKEND_TOKEN`은 이전 image가 읽지 않으므로 남겨 두어도 된다.

## 완료 조건

- 관리자 화면의 모든 학습자료 호출이 Server Action을 거친다.
- `src/components/study/` 아래에 `/api/study/v1` 문자열이 남지 않는다.
- 브라우저 번들과 RSC 응답에 Backend token이 없다.
- 14개 route가 접근 기록을 남기고 그 기록에 비밀값이 없다.
- 검증 절의 명령이 모두 종료 코드 0이다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `src/env.ts` | Backend 환경 변수 추가 |
| `.env.example` | 비밀값 없는 예시 추가 |
| `src/lib/study/backend-client.ts` | 신규 |
| `src/lib/study/backend-client.test.ts` | 신규 |
| `src/app/admin/(protected)/study/actions.ts` | 신규 |
| `src/app/admin/study-backend-actions.test.ts` | 신규 |
| `src/app/admin/(protected)/study/recommendations/[reportId]/page.tsx` | 서비스 직접 호출을 client 호출로 수정 |
| `src/app/admin/(protected)/study/page.tsx` | action props 전달로 수정 |
| `src/app/admin/(protected)/study/imports/page.tsx` | action props 전달로 수정 |
| `src/app/admin/(protected)/study/recommendations/page.tsx` | action props 전달로 수정 |
| `src/components/study/StudyLibrary.tsx` | 상대 API fetch를 action props로 수정 |
| `src/components/study/RecommendationReport.tsx` | 상대 API fetch를 action props로 수정 |
| `src/components/study/RecommendationHistory.tsx` | 상대 API fetch를 action props로 수정 |
| `src/components/study/ImportPanel.tsx` | 상대 API fetch를 action props로 수정 |
| `src/lib/study/contracts.ts` | 관리자 UI DTO 경계 정리 |
| `src/lib/study/auth.ts` | 접근 기록 추가 |
| `src/lib/study/auth.test.ts` | 접근 기록 검증 추가 |
| `src/components/study/StudyLibrary.test.tsx` | action props 사용으로 수정 |
| `src/components/study/ImportPanel.test.tsx` | action props 사용으로 수정 |
| `src/app/admin/study-workflow.test.tsx` | 서비스 mock을 action mock으로 수정 |
