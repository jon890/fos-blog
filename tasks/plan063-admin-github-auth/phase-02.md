# Phase 02. GitHub 계정 검사와 서버 세션

**Execution profile**: deep

## 목표

다른 GitHub 계정의 생성·연결·재로그인을 막고 매 요청에 현재 관리자 계정을 검사한다.

**범위 외**: 관리자 페이지와 공부 API는 만들지 않는다.

## 컨텍스트

선행 plan은 없다. 기존 계획 문서가 포함된 브랜치에서 시작한다. plan061·064·062는 이 plan 뒤에 실행한다.
이 plan의 phase-01 완료 코드 위에서 실행한다.
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

### 1. 인증 구성과 설정

`src/lib/admin/auth.ts`에 `createAdminAuth(db, config)`와 서버용 지연 초기화를 구현한다.
`src/env.ts`와 `.env.example`에 코드 아키텍처의 관리자 환경 설정만 추가하고 실제 값은 쓰지 않는다.
`user.validateUserInfo`는 source.method/provider/action을 검사하고 `source.oauth.profile.id`를 현재 단일 numeric ID와 비교한다.
`user.id`, 이메일, login 이름과 첫 사용자 여부로 권한을 부여하지 않는다.
link-account는 본인이라도 거절하고 emailAndPassword와 accountLinking을 false로 둔다.
adapter transaction을 켜고 DB 스키마를 명시적으로 전달한다.
세션은 7일 고정 만료, 자동 갱신과 cookieCache 비활성으로 구성한다.

### 2. 세션 검사와 HTTP 노출 제한

`src/lib/admin/session.ts`에 `getAdminSession`, `requireAdminPage`를 구현한다.
DB 세션을 조회한 후 같은 userId의 github accountId와 현재 환경 allowlist를 대조한다.
세션 없음·허용 계정 불일치·DB 장애를 구분하며 공유 캐시는 사용하지 않는다.
`src/app/api/auth/[...all]/route.ts`는 HTTP 계약의 공통 관리자 인증 API 네 endpoint와 메서드만 허용한다.
POST Origin, callbackURL 경로 제한, callback state 검증과 일반화한 오류 안내를 적용한다.
`/get-session`에도 현재 계정 검사를 적용하고 불필요한 account/token 정보를 반환하지 않는다.
`src/infra/db/index.ts`의 개발 SQL parameter 로그를 끄고 인증 logger에서도 프로필·토큰·DB URL을 제거한다.

### 3. 인증과 세션 테스트

`src/lib/admin/auth.test.ts`, `session.test.ts`, 인증 Route의 `route.test.ts`를 만든다.
GitHub 응답을 테스트 내부에서 대체해 최초 본인 로그인과 기존 계정 재로그인이 성공함을 확인한다.
다른 ID, missing ID, unsafe number, 동일 이메일의 다른 ID, link-account와 다른 provider는 계정·세션을 만들지 못해야 한다.
세션 삭제·만료·account 삭제·env ID 변경 후 기존 쿠키를 거절하고 DB 오류를 503으로 구분한다.
변조 state, 외부·프로토콜 상대·/administrator 복귀, Origin 없음·불일치와 차단 endpoint도 검증한다.
테스트 전용 HTTP 우회 endpoint나 운영 플래그를 추가하지 않는다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
RUN_DB_TESTS=1 pnpm exec vitest run 'src/lib/admin/auth.test.ts' 'src/lib/admin/session.test.ts' 'src/app/api/auth/[...all]/route.test.ts'
pnpm lint
pnpm type-check
pnpm test
pnpm build
git diff --check
```

통과하면 현재 phase의 검증 결과를 기록하고 다음 phase로 진행한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `src/lib/admin/auth.ts` | 신규 또는 기존 내용 확장 |
| `src/lib/admin/session.ts` | 신규 또는 기존 내용 확장 |
| `src/lib/admin/auth.test.ts` | 신규 또는 기존 내용 확장 |
| `src/lib/admin/session.test.ts` | 신규 또는 기존 내용 확장 |
| `src/app/api/auth/[...all]/route.ts` | 신규 또는 기존 내용 확장 |
| `src/app/api/auth/[...all]/route.test.ts` | 신규 또는 기존 내용 확장 |
| `src/env.ts` | 신규 또는 기존 내용 확장 |
| `.env.example` | 신규 또는 기존 내용 확장 |
| `src/infra/db/index.ts` | 신규 또는 기존 내용 확장 |
