# Phase 02. 과거 이력 dry-run과 원자적 commit

**Execution profile**: deep

## 목표

옛 리포트의 반복 자료와 없는 설명을 보존하고 본인의 미리보기 확인 후 저장한다.

**범위 외**: 외부 파일·Pages fetch, 설명 자동 생성, 서비스의 import commit과 파일 업로드 UI는 구현하지 않는다.

## 컨텍스트

plan063과 plan061 완료 코드가 현재 브랜치에 있어야 한다. 공유 StudyRepository와 contracts.ts는 이 plan에서 이어 수정하며 다른 plan과 병렬 편집하지 않는다.
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

### 1. 가져오기 검증

`src/services/study/imports.ts`에 previewImport/commitImport와 ImportReport/Topic/Item 스키마를 만든다.
careerQuestion·summary·reason·careerValue는 옛 이력의 null을 보존한다.
source 존재·category 일치·canonical URL/key 검증, report/topic/item 중복과 개수 제한을 적용한다.
dry-run은 정규 payload hash·historyVersion·counts·warnings만 계산하고 DB에 쓰지 않는다.
현재 자료가 없을 때만 import 기본 메타로 만들고 기존 자료는 source 연결 외에 바꾸지 않는다.

### 2. commit과 재전송

commit은 control 잠금 뒤 영수증 재조회와 동일 검증을 수행한다.
previewHash와 expectedHistoryVersion이 바뀌면 IMPORT_CHANGED로 거절한다.
동일 importKey의 같은 본문 재시도는 버전 비교보다 먼저 원래 응답을 반환하고 다른 본문은 충돌한다.
같은 과거 자료가 서로 다른 리포트에 있으면 이력은 각각 보존하고 누적 집합만 합친다.
동일 reportId의 동일 정규 내용은 건너뛰고 다른 내용은 충돌한다.
삽입 순서·latest pointer·historyVersion 증가 정책은 HTTP 계약 마지막 절을 따른다.

### 3. 가져오기 실DB 테스트

`src/services/study/imports.test.ts`에서 dry-run 전후 DB 행·버전이 동일함을 확인한다.
누락 설명 null, 과거 반복 자료, 동일 기존 리포트 skip과 다른 내용 충돌을 검증한다.
미리보기 뒤 추천 저장, payload 변경, 동시 import와 응답 유실 재전송을 검증한다.
중간 item 실패 시 자료·snapshot·누적 집합·영수증 모두 rollback되고 오래된 리포트가 최신 포인터를 되돌리지 않아야 한다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
RUN_DB_TESTS=1 pnpm exec vitest run 'src/services/study/imports.test.ts'
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
| `src/services/study/imports.ts` | 신규 또는 기존 내용 확장 |
| `src/services/study/imports.test.ts` | 신규 또는 기존 내용 확장 |
| `src/infra/db/repositories/StudyRepository.ts` | 신규 또는 기존 내용 확장 |
| `src/lib/study/contracts.ts` | 신규 또는 기존 내용 확장 |
