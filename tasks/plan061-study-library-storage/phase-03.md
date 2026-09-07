# Phase 03. 자료 배치와 cursor 원자 저장

**Execution profile**: deep

## 목표

수집 재전송에 같은 영수증을 반환하고 자료 실패 시 cursor를 진행시키지 않는다.

**범위 외**: 수집 실행·원문 fetch·모델 선택·추천 저장은 수행하지 않는다.

## 컨텍스트

plan063-admin-github-auth가 완료되고 그 코드가 현재 브랜치에 포함되어 있어야 한다. 이 plan 뒤에 plan064를 실행한다.
이 plan의 phase-02 완료 코드 위에서 실행한다.
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

### 1. 수집 트랜잭션

`src/services/study/ingestion.ts`의 ingestBatch와 StudyRepository의 트랜잭션 메서드를 구현한다.
영수증 확인, source/mode cursor 잠금, 재확인, expectedCursorVersion 비교 후 자료·태그·소스 연결·cursor·영수증을 같은 tx에 저장한다.
같은 key/같은 정규 본문은 원래 영수증, 다른 본문은 IDEMPOTENCY_CONFLICT다.
JSON 객체 key 정렬과 배열 순서 보존을 공통 해시 함수로 사용한다.
잠금 처리에 전역 DB 객체를 섞지 않는다.

### 2. 경합·갱신 정책

자료를 contentKey 오름차순으로 처리하고 더 최신 collectedAt에만 메타·태그를 갱신한다.
개인 상태와 추천 snapshot은 갱신하지 않으며 소스 연결 collectedAt은 가장 큰 값을 유지한다.
정상 items 0개도 cursor를 진행할 수 있고 비활성 소스·잘못된 URL/key는 전체 요청을 거절한다.
deadlock은 전체 rollback 뒤 최대 2회 재시도하고 소진 시 503, version 충돌은 자동 재시도하지 않는다.

### 3. 수집 실DB 테스트

`src/services/study/ingestion.test.ts`에서 응답 유실 재전송, 동일 멱등키 동시 요청, 다른 batch의 cursor version 충돌을 검증한다.
자료 중간 INSERT 실패를 주입했을 때 자료·cursor·영수증이 모두 rollback되어야 한다.
동일 자료의 여러 소스 수집, 같은 collectedAt의 다른 메타, 빈 성공 배치와 배열 중복 오류를 확인한다.
개인 note와 기존 추천 snapshot 보존, deadlock 재시도 상한도 검증한다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
RUN_DB_TESTS=1 pnpm exec vitest run 'src/services/study/ingestion.test.ts'
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
| `src/services/study/ingestion.ts` | 신규 또는 기존 내용 확장 |
| `src/services/study/ingestion.test.ts` | 신규 또는 기존 내용 확장 |
| `src/infra/db/repositories/StudyRepository.ts` | 신규 또는 기존 내용 확장 |
| `src/lib/study/contracts.ts` | 신규 또는 기존 내용 확장 |
