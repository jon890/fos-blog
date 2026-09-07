# Phase 01. 인증 의존성과 MySQL 스키마

**Execution profile**: standard

## 목표

승인된 Better Auth 의존성과 별도 인증 테이블을 준비한다.

**범위 외**: 로그인 Handler와 화면, study 스키마는 다음 phase와 plan061 책임이다.

## 컨텍스트

선행 plan은 없다. 기존 계획 문서가 포함된 브랜치에서 시작한다. plan061·064·062는 이 plan 뒤에 실행한다.
docs를 먼저 확정한 계획이므로 phase 실행 중 제품·인증·API 결정을 새로 만들지 않는다.
현재 작업은 한 저장소의 구현 worktree에서만 수행하며 다른 작업자의 변경을 되돌리지 않는다.

**근거 문서**: [요구사항](../../docs/prd.md#공통-관리자와-개인-학습자료-요구), [관리자 인증 설정](../../docs/code-architecture.md#관리자-인증-허용-계정-판정), [HTTP 계약](../../docs/api/study-library.md), [저장 계약](../../docs/data-schema.md), [흐름](../../docs/flow.md), [모듈 배치](../../docs/code-architecture.md).

## 의도 메모

### 계획 합의와 실행 순서

2026-09-07 GitHub 본인 계정만 허용하는 Better Auth와 필요한 Drizzle patch를 사용자가 승인했다.
기존 문서 초안의 제품·화면·저장·소비 계약을 보존하고 별도 계획·인증 문서의 내용을 책임 문서로 통합했다.
공개 요구는 PRD, 정상·실패 흐름은 flow, HTTP는 API, 저장 모델은 data-schema, 설정·모듈·근거는 code-architecture에 둔다.
장기 결정은 ADR-037·038에 기록한다. 이번 계획 단계의 미결 사용자 결정은 없다.

| 실행 순서 | plan | 검토 단위 |
| --- | --- | --- |
| 1 | [plan063](./index.json) | 인증 의존성·DB, 서버 검증, 공개 레이아웃 분리, 관리자 UI |
| 2 | [plan061](../plan061-study-library-storage/index.json) | study 스키마, 자료·소스 조회와 상태, 수집, 자료 HTTP |
| 3 | [plan064](../plan064-study-library-recommendations/index.json) | 추천·게시, 가져오기, 해당 HTTP |
| 4 | [plan062](../plan062-study-library-ui/index.json) | 자료 컴포넌트·페이지, 추천·가져오기 컴포넌트·페이지 |

원격 최대 예약 번호 062를 `git ls-remote --heads origin`으로 재확인하고 기존 061·062를 유지했다.
추가 063·064 예약 브랜치를 생성했으며 코디네이터가 위 4분할과 순서를 확인했다.
단계 1부터 7까지 구현 가능성·기술·흐름·인터페이스·API·스키마·docs를 검토한 후 task를 생성했다.
현재 index status는 구현 대기인 pending이다. 이 계획 생성 세션에서는 docs/tasks만 커밋·푸시한다.
후속 `build-with-teams` 구현 세션은 코디네이터가 별도로 생성한다.
소비측 career-os plan115는 독립 세션에서 작업하며 HTTP 계약 변경은 코디네이터와 조율한다.

### 구현 시 주의점

계획 생성 시 4개 plan의 verify_task와 Markdown 23개의 한국어·가독성·상대 링크·앵커 검사를 통과했다.
소비 API의 자료 URL 식별부터 이력 가져오기까지 본문은 기존 합의와 일치함을 문자열 대조로 확인했다.
code-reviewer는 사용량 제한으로 실행되지 않아 메인이 계약과 경로를 직접 검증했다.
아래 구현 테스트와 실DB·브라우저 검증은 아직 수행하지 않았으며 후속 구현 세션의 완료 조건이다.

- 공개 posts 모델과 study 자료를 합치지 않는다. 서비스 토큰과 관리자 세션의 권한을 분리한다.
- 실제 계정 ID·secret·운영 호스트는 환경으로만 주입한다. 테스트와 문서에 실제 값을 넣지 않는다.
- 기존 Repository와 UI를 재사용하고 승인된 Better Auth·Drizzle patch 외의 직접 의존성을 추가하지 않는다.

## Blocked 조건

선행 코드가 없으면 `PHASE_BLOCKED: 선행 plan 또는 phase 코드 없음`으로 보고한다.
실DB 검증에 격리된 TEST_DATABASE_URL이 없으면 `PHASE_BLOCKED: 격리 MySQL 검증 환경 없음`으로 보고한다.
운영 DB와 배포를 대신 실행하거나 테스트 성공을 추정하지 않는다.

## 작업 항목

### 1. 의존성 및 스키마

`package.json`에 `better-auth` 1.7.3을 추가하고 `drizzle-orm` 최소 버전을 0.45.2로 올린다.
`pnpm-lock.yaml`도 함께 갱신하고 Next.js·React·mysql2·drizzle-kit은 유지한다.
직접 jose 또는 다른 인증 패키지를 추가하지 않는다.
`src/infra/db/schema/auth.ts`에 관리자 인증 저장 계약의 네 테이블을 만들고 schema/index.ts에서 export한다.
SQL 이름과 camelCase 필드 매핑, binary ID, session token UNIQUE와 account 복합 UNIQUE를 빠짐없이 반영한다.

### 2. 검증용 DB와 마이그레이션

`src/infra/db/test-utils.ts`에 `TEST_DATABASE_URL`과 `RUN_DB_TESTS=1`로 실행하는 격리 DB 검증 도우미를 둔다.
loopback 호스트와 `fos_blog_test_` 접두사를 검사하고 일반 DATABASE_URL로 대신 쓰지 않는다.
`pnpm db:generate`로 추가 테이블만 생성하고 생성 SQL·metadata를 스키마와 함께 관리한다.
운영 DB 또는 기존 사용자 데이터에 migrate를 실행하지 않는다. 생성 SQL을 손으로 수정하지 않는다.

### 3. 스키마 테스트

`src/infra/db/schema/auth.test.ts`에서 격리 MySQL migration 적용과 재실행을 확인한다.
같은 provider/account ID와 session token 중복 거절, user 삭제의 session/account cascade, 다른 기존 테이블 무변경을 검증한다.
DB 설정 없이 명시적으로 실DB 검증을 실행하면 실패해야 한다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
RUN_DB_TESTS=1 pnpm exec vitest run 'src/infra/db/schema/auth.test.ts'
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
| `package.json` | 신규 또는 기존 내용 확장 |
| `pnpm-lock.yaml` | 신규 또는 기존 내용 확장 |
| `src/infra/db/schema/auth.ts` | 신규 또는 기존 내용 확장 |
| `src/infra/db/schema/index.ts` | 신규 또는 기존 내용 확장 |
| `src/infra/db/schema/auth.test.ts` | 신규 또는 기존 내용 확장 |
| `src/infra/db/test-utils.ts` | 신규 또는 기존 내용 확장 |
| `drizzle/` | 명시한 하위 파일 생성 또는 이동 |
