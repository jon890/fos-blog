# Phase 01. 후보와 추천·게시 이력 서비스

**Execution profile**: deep

## 목표

추천 중복과 직전 주제 충돌을 막고 게시 성공 이력을 저장한다.

**범위 외**: 모델 판단·외부 게시 실행·이력 파일 수집과 UI는 범위 밖이다.

## 컨텍스트

plan063과 plan061 완료 코드가 현재 브랜치에 있어야 한다. 공유 StudyRepository와 contracts.ts는 이 plan에서 이어 수정하며 다른 plan과 병렬 편집하지 않는다.
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

### 1. 후보 조회와 추천 저장

`src/services/study/recommendations.ts`와 StudyRepository를 확장한다.
listCandidates는 Candidate.id=contentKey, absent excerpt 생략, sourceKey 기준 활성 출처 선택을 지킨다.
후보의 첫 historyVersion을 고정하고 페이지 도중 변경은 409로 반환한다.
모든 후보 조회 후 saveRecommendationRun은 control 행을 잠그고 reportId 영수증·직전 topic·누적 추천을 재검사한다.
report/topic/item snapshot·누적 집합·commit 순번·historyVersion을 한 tx에 저장한다.
빈 topics도 정상 실행 이력이며 latest pointer를 갱신한다.

### 2. 이력 조회와 게시 기록

listRecommendationRuns/getRecommendationRun은 목록·상세 계약을 그대로 반환한다.
추천 당시 title/canonicalUrl과 현재 state를 구분하며 조회가 원본 snapshot을 바꾸지 않는다.
recordPublication은 reportId/channel/externalId 고유 키와 요청 멱등키를 검사하고 같은 기록에 같은 ID를 반환한다.
게시 실패나 기록 실패로 추천을 삭제하거나 재추천 가능하게 바꾸지 않는다.
이 phase의 요청·응답 Zod 타입을 `contracts.ts`에 추가하고 과거 import nullable 필드는 조회에서 보존한다.

### 3. 추천·게시 실DB 테스트

`src/services/study/recommendations.test.ts`에서 동일 자료와 직전 주제를 동시에 선택한 두 요청 중 하나만 성공함을 검증한다.
같은 reportId 같은 본문 재시도는 원래 historyVersion, 다른 본문은 409여야 한다.
추천 중간 실패는 전체 rollback, 0건 추천과 과거 null 조회, source 필터와 historyVersion 페이지 충돌도 확인한다.
게시 고유 키·멱등키 경합과 같은 기록 재전송, 실패 뒤 추천 이력 보존을 검증한다.
추천 저장 후 `GET /materials?recommended=true`의 자료 목록과 `Material.previouslyRecommended`가 갱신되는지 회귀 검증한다.
자료 필드와 필터 구현은 plan061 phase02의 책임이며 이 phase는 추천 저장과 조회의 연결을 검증한다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
RUN_DB_TESTS=1 pnpm exec vitest run 'src/services/study/recommendations.test.ts'
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
| `src/services/study/recommendations.ts` | 신규 또는 기존 내용 확장 |
| `src/services/study/recommendations.test.ts` | 신규 또는 기존 내용 확장 |
| `src/infra/db/repositories/StudyRepository.ts` | 신규 또는 기존 내용 확장 |
| `src/lib/study/contracts.ts` | 신규 또는 기존 내용 확장 |
