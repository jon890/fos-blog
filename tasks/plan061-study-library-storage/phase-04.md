# Phase 04. 서비스 권한과 자료·소스 Route Handler

**Execution profile**: deep

## 목표

확정된 HTTP 소비 계약을 인증·검증·서비스 조합으로 노출한다.

**범위 외**: candidates·recommendation-runs·publications·imports Route는 plan064에서 추가한다.

## 컨텍스트

plan063-admin-github-auth가 완료되고 그 코드가 현재 브랜치에 포함되어 있어야 한다. 이 plan 뒤에 plan064를 실행한다.
이 plan의 phase-03 완료 코드 위에서 실행한다.
현재 작업은 한 저장소의 구현 worktree에서만 수행하며 다른 작업자의 변경을 되돌리지 않는다.

**근거 문서**: [요구사항](../../docs/prd.md#공통-관리자와-개인-학습자료-요구), [관리자 인증 설정](../../docs/code-architecture.md#관리자-인증-허용-계정-판정), [HTTP 계약](../../docs/api/study-library.md), [저장 계약](../../docs/data-schema.md), [흐름](../../docs/flow.md), [모듈 배치](../../docs/code-architecture.md).

## 의도 메모

- 공개 posts 모델과 study 자료를 합치지 않는다. 서비스 토큰과 관리자 세션의 권한을 분리한다.
- 실제 계정 ID·secret·운영 호스트는 환경으로만 주입한다. 테스트와 문서에 실제 값을 넣지 않는다.
- 기존 Repository와 UI를 재사용하고 승인된 Better Auth·Drizzle patch 외의 직접 의존성을 추가하지 않는다.

## Blocked 조건

선행 코드가 없으면 `PHASE_BLOCKED: 선행 plan 또는 phase 코드 없음`으로 보고한다.
실DB 검증에 격리된 TEST_DATABASE_URL이 없으면 `PHASE_BLOCKED: 격리 MySQL 검증 환경 없음`으로 보고한다.
운영 DB와 배포를 대신 실행하거나 테스트 성공을 추정하지 않는다.

## 작업 항목

### 1. 공통 HTTP와 권한

`src/lib/study/auth.ts`, `http.ts`에 서비스 Bearer 우선 판정, 관리자 DB 세션 검사와 endpoint별 권한표를 만든다.
`src/env.ts`, `.env.example`에 선택 STUDY_SERVICE_TOKEN과 주석을 추가한다.
서비스 secret은 최소 32바이트 난수이며 같은 길이 hash 상수시간 비교로 검사한다.
Bearer가 있으면 실패해도 브라우저 세션으로 우회하지 않는다. 브라우저 쓰기만 Origin 필수 검사를 적용한다.
수신 stream의 실제 바이트 수 1 MiB 제한, JSON·Zod 검증, private/no-store·noindex, requestId와 일반 오류 envelope를 구현한다.
DB 원문 오류와 request body를 로그에 남기지 않는다.

### 2. Route 연결

`src/app/api/study/v1/sources/route.ts`, `sources/[sourceKey]/route.ts`, `sources/[sourceKey]/cursor/route.ts`를 만든다.
`materials/route.ts`, `materials/[id]/route.ts`, `materials/[id]/state/route.ts`, `ingestions/route.ts`를 만든다.
메서드와 주체는 HTTP 문서의 표를 그대로 적용하고 Route는 도메인 tx를 직접 조합하지 않는다.
단건 Material과 Source DTO, 목록 cursor·버전 및 수집 영수증은 문서와 동일해야 한다.
미지원 메서드는 405이며 study 인증 오류는 로그인 HTML로 이동시키지 않는다.

### 3. HTTP 계약 테스트

`src/app/api/study/v1/storage-routes.test.ts`와 `src/lib/study/auth.test.ts`, `http.test.ts`를 만든다.
익명 401, 잘못된 Bearer와 유효 cookie 동시 요청 401, 서비스의 상태 쓰기 403, 브라우저의 ingestion 403을 검증한다.
실제 바이트 1 MiB 초과·위조 Content-Length·unknown field·Origin 불일치와 각 정상 DTO를 검증한다.
429가 발생하는 공통 경로는 Retry-After를 유지하고 400·401·403·404·409·413·503에도 개인 응답 헤더를 적용한다.
서비스가 소스 등록→cursor 조회→수집→같은 영수증 재조회까지 실행하는 HTTP 통합 테스트를 포함한다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
RUN_DB_TESTS=1 pnpm exec vitest run 'src/app/api/study/v1/storage-routes.test.ts' 'src/lib/study/auth.test.ts' 'src/lib/study/http.test.ts'
pnpm lint
pnpm type-check
pnpm test
pnpm build
git diff --check
```

이 plan의 모든 phase 검증이 통과한 뒤에만 `index.json`의 status를 `completed`로 바꾼다.
실패 또는 검증 불가는 완료로 표시하지 않는다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `src/lib/study/auth.ts` | 신규 또는 기존 내용 확장 |
| `src/lib/study/auth.test.ts` | 신규 또는 기존 내용 확장 |
| `src/lib/study/http.ts` | 신규 또는 기존 내용 확장 |
| `src/lib/study/http.test.ts` | 신규 또는 기존 내용 확장 |
| `src/env.ts` | 신규 또는 기존 내용 확장 |
| `.env.example` | 신규 또는 기존 내용 확장 |
| `src/app/api/study/v1/storage-routes.test.ts` | 신규 또는 기존 내용 확장 |
| `src/app/api/study/v1/sources/` | 명시한 하위 파일 생성 또는 이동 |
| `src/app/api/study/v1/materials/` | 명시한 하위 파일 생성 또는 이동 |
| `src/app/api/study/v1/ingestions/route.ts` | 신규 또는 기존 내용 확장 |
