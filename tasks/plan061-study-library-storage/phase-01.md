# Phase 01. 학습자료 스키마와 공통 입력 계약

**Execution profile**: standard

## 목표

URL 자료 식별과 저장 제약을 고정하고 study 테이블을 준비한다.

**범위 외**: 추천·가져오기 동작은 plan064에서 만든다. 여기서는 FK 의존 때문에 해당 테이블도 함께 생성한다.

## 컨텍스트

plan063-admin-github-auth가 완료되고 그 코드가 현재 브랜치에 포함되어 있어야 한다. 이 plan 뒤에 plan064를 실행한다.
docs를 먼저 확정한 계획이므로 phase 실행 중 제품·인증·API 결정을 새로 만들지 않는다.
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

### 1. 스키마와 마이그레이션

`src/infra/db/schema/study.ts`에 저장 문서의 13개 study 테이블을 만들고 index.ts에서 export한다.
ID·버전·UTC DATETIME(3)·nullable·binary UNIQUE·FK RESTRICT와 추천 항목의 run/topic 일치를 보장한다.
순환 관계인 control.latest_run_id는 nullable FK로 정의하고 초기 owner/0/null 행을 준비한다.
source 생성 시 recent/archive cursor version 0 두 행을 만들 수 있도록 복합 PK를 둔다.
`pnpm db:generate` 산출물에서 기존 테이블 삭제·변경이 없는지 확인하고 격리 MySQL에 적용한다.

### 2. 공통 계약과 URL 식별

`src/lib/study/contracts.ts`에 공통 오류·enum·Source·Material·Candidate 및 이번 plan의 입력·응답 스키마를 작성한다.
HTTP 계약의 선택값·null·문자 수·unknown field 거절·HTTPS 제한을 그대로 따른다.
`src/lib/study/url-identity.ts`는 API의 career-os URL 식별 규칙을 구현한다.
기존 career-os fixture는 읽기만 하며 이 세션에서 다른 저장소를 수정하지 않는다.
YouTube ID 대소문자, 일반 URL의 의미 있는 query와 www 구분을 보존한다.

### 3. 스키마와 식별 테스트

`src/infra/db/schema/study.test.ts`, `src/lib/study/contracts.test.ts`, `url-identity.test.ts`를 만든다.
실DB migration 재실행·FK·동일 contentKey 중복·대소문자가 다른 YouTube 키 공존을 검증한다.
tracking query 제거와 query sort, fragment·trailing slash, 비HTTPS 거절, 잘못된 전송 key/URL 불일치를 검증한다.
선택값 생략과 null의 차이, 배열 중복·Unicode 길이·unknown field 오류를 확인한다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
RUN_DB_TESTS=1 pnpm exec vitest run 'src/infra/db/schema/study.test.ts' 'src/lib/study/contracts.test.ts' 'src/lib/study/url-identity.test.ts'
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
| `src/infra/db/schema/study.ts` | 신규 또는 기존 내용 확장 |
| `src/infra/db/schema/study.test.ts` | 신규 또는 기존 내용 확장 |
| `src/infra/db/schema/index.ts` | 신규 또는 기존 내용 확장 |
| `src/lib/study/contracts.ts` | 신규 또는 기존 내용 확장 |
| `src/lib/study/contracts.test.ts` | 신규 또는 기존 내용 확장 |
| `src/lib/study/url-identity.ts` | 신규 또는 기존 내용 확장 |
| `src/lib/study/url-identity.test.ts` | 신규 또는 기존 내용 확장 |
| `drizzle/` | 명시한 하위 파일 생성 또는 이동 |
