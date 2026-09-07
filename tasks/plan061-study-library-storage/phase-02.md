# Phase 02. 소스·자료 조회와 개인 상태 Repository

**Execution profile**: deep

## 목표

소스 버전과 개인 상태 충돌을 DB에서 보호하고 목록·단건 DTO를 제공한다.

**범위 외**: 배치 수집과 후보·추천 조회는 후속 phase와 plan064 책임이다.

## 컨텍스트

plan063-admin-github-auth가 완료되고 그 코드가 현재 브랜치에 포함되어 있어야 한다. 이 plan 뒤에 plan064를 실행한다.
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

### 1. Repository와 서비스

`StudyRepository.ts`와 기존 repositories/index.ts에 study 팩터리를 추가한다.
`src/services/study/sources.ts`는 putSource/listSources/getSourceCursor를 제공한다.
소스 PUT은 필수 필드를 모두 받으며 최초 생성 0과 현재 version 비교, cursor 두 행의 원자 생성을 적용한다.
`src/services/study/materials.ts`는 listMaterials/getMaterial/updateMaterialState를 제공한다.
개인 상태는 서버의 owner만 사용하고 조건부 UPDATE 또는 최초 INSERT 경합을 409로 변환한다.

### 2. 필터와 DTO 매핑

자료 id DESC, 최초 최대 ID와 필터 해시가 포함된 cursor를 구현한다.
q의 SQL LIKE 이스케이프, publishedAt null 구분과 반열린 UTC 범위, boolean 필터를 계약대로 적용한다.
새 수집이 진행 중 목록에 끼어들지 않도록 하고 출처 조합은 N+1 쿼리로 읽지 않는다.
Date는 ISO로 직렬화하고 미생성 state는 false/false/빈 note/version 0/updatedAt null로 반환한다.
존재하지 않는 ID는 404, DB 장애는 503이며 빈 목록으로 대체하지 않는다.

### 3. 조회·경합 테스트

`StudyRepository.test.ts`, `sources.test.ts`, `materials.test.ts`에서 실제 MySQL을 사용한다.
소스 최초 생성 경합과 오래된 버전, 개인 상태 첫 INSERT 및 UPDATE 동시 수정에서 한 번만 성공함을 확인한다.
검색 특수문자, 소스 다중 연결, 날짜 null, keyset 첫 최대 ID와 필터 mismatch, 단건 404를 검증한다.
기존 메모가 다른 기기 입력으로 자동 병합·덮어쓰기되지 않는지 확인한다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
RUN_DB_TESTS=1 pnpm exec vitest run 'src/infra/db/repositories/StudyRepository.test.ts' 'src/services/study/sources.test.ts' 'src/services/study/materials.test.ts'
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
| `src/infra/db/repositories/StudyRepository.ts` | 신규 또는 기존 내용 확장 |
| `src/infra/db/repositories/StudyRepository.test.ts` | 신규 또는 기존 내용 확장 |
| `src/infra/db/repositories/index.ts` | 신규 또는 기존 내용 확장 |
| `src/services/study/sources.ts` | 신규 또는 기존 내용 확장 |
| `src/services/study/sources.test.ts` | 신규 또는 기존 내용 확장 |
| `src/services/study/materials.ts` | 신규 또는 기존 내용 확장 |
| `src/services/study/materials.test.ts` | 신규 또는 기존 내용 확장 |
