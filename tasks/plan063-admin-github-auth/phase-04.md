# Phase 04. 관리자 로그인·홈·로그아웃 UI

**Execution profile**: standard

## 목표

공통 관리자 진입점을 제공하고 서버의 현재 허용 계정 검사에 연결한다.

**범위 외**: 공부 목록·추천·가져오기 페이지는 plan062에서 만든다.

## 컨텍스트

선행 plan은 없다. 기존 계획 문서가 포함된 브랜치에서 시작한다. plan061·064·062는 이 plan 뒤에 실행한다.
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

### 1. 로그인과 계정 표시

`src/lib/admin/client.ts`는 `better-auth/react`의 createAuthClient를 사용한다.
`AdminLoginButton`, `AdminNavigation`, `AdminSignOutButton`을 `src/components/admin/`에 만든다.
버튼은 로그인·로그아웃만 호출하고 user update·계정연결·비밀번호 API는 호출하지 않는다.
`src/app/admin/login/page.tsx`에는 GitHub 로그인 버튼과 취소·권한 없음·설정 부재·장애 안내를 제공한다.
이미 허용된 세션이면 /admin으로 이동하고 오류 설명은 허용 코드 목록에서만 선택한다.

### 2. 관리자 홈과 보호 layout

`src/app/admin/(protected)/layout.tsx`와 `page.tsx`에서 각각 서버 검사를 호출한다.
홈에는 읽기 전용 본인 계정과 공부 메뉴를 표시한다. 공부 페이지 구현 전에는 준비 중으로 알려 깨진 링크를 노출하지 않는다.
메뉴 경로는 흐름 문서대로 고정하고 plan062에서 활성화한다.
로그아웃 실패를 성공으로 표시하지 않고 서버 session 철회 성공 후 /admin/login으로 이동한다.
외부 avatar 자동 요청을 만들지 않고 키보드 초점과 aria-live로 동작 상태를 알린다.

### 3. 관리자 화면 테스트

`src/components/admin/AdminLoginButton.test.tsx`, `AdminSignOutButton.test.tsx`, `src/app/admin/admin-pages.test.tsx`를 만든다.
익명 페이지 진입, 본인 세션, 현재 허용되지 않은 세션, DB 장애, 로그인 취소와 로그아웃 실패를 검증한다.
격리 MySQL의 정상 테스트 세션을 브라우저 두 컨텍스트에 넣어 한 세션 철회 후 해당 요청이 거절되는지 확인한다.
운영 OAuth secret 없이도 provider mock과 실제 세션 검증으로 동작을 증명하며 관리자 우회 기능을 제품 코드에 추가하지 않는다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
pnpm exec vitest run 'src/components/admin/AdminLoginButton.test.tsx' 'src/components/admin/AdminSignOutButton.test.tsx' 'src/app/admin/admin-pages.test.tsx'
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
| `src/lib/admin/client.ts` | 신규 또는 기존 내용 확장 |
| `src/components/admin/` | 명시한 하위 파일 생성 또는 이동 |
| `src/app/admin/login/page.tsx` | 신규 또는 기존 내용 확장 |
| `src/app/admin/(protected)/layout.tsx` | 신규 또는 기존 내용 확장 |
| `src/app/admin/(protected)/page.tsx` | 신규 또는 기존 내용 확장 |
| `src/app/admin/admin-pages.test.tsx` | 신규 또는 기존 내용 확장 |
