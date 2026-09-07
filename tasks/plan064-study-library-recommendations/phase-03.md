# Phase 03. 추천·게시·가져오기 Route와 소비 계약 검증

**Execution profile**: standard

## 목표

career-os와 관리자 UI가 같은 문서의 추천·가져오기 DTO를 소비하도록 연결한다.

**범위 외**: career-os 저장소 수정과 실제 외부 게시, 관리자 화면은 범위 밖이다.

## 컨텍스트

plan063과 plan061 완료 코드가 현재 브랜치에 있어야 한다. 공유 StudyRepository와 contracts.ts는 이 plan에서 이어 수정하며 다른 plan과 병렬 편집하지 않는다.
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

### 1. Route 연결

`src/app/api/study/v1/candidates/route.ts`, `recommendation-runs/route.ts`, `recommendation-runs/[reportId]/route.ts`를 만든다.
`publications/route.ts`, `imports/dry-run/route.ts`, `imports/commit/route.ts`를 만든다.
기존 auth/http 공통 함수를 재사용하고 candidates·추천 저장·게시 저장은 서비스, 추천 조회는 본인만 허용한다.
dry-run은 본인 또는 서비스, commit은 본인만 허용한다.
GET query와 DTO·opaque cursor·null·버전·멱등키를 HTTP 계약대로 유지한다.

### 2. 경계와 운영 문구

각 Handler에서 인증·본문 제한·오류 envelope를 동일하게 적용한다.
브라우저 commit의 Origin과 previewHash 검증은 UI 확인 여부에 의존하지 않고 서버가 다시 처리한다.
외부 URL fetch를 추가하지 않는다.
소비 fixture는 career-os plan115의 URL identity 및 reports/entries 호환 기준과 대조하고 API 변경이 필요하면 코디네이터에게 먼저 알린다.

### 3. HTTP 통합 테스트

`src/app/api/study/v1/recommendation-routes.test.ts`에서 서비스 수집→후보→추천→게시 기록과 관리자 이력 조회를 연결한다.
서비스 import commit 403, 브라우저 dry-run/commit 성공, 변경된 이력 IMPORT_CHANGED, 과거 null 상세 DTO를 검증한다.
Candidate.id 문자열과 excerpt 생략, Material.state, 빈 추천의 recentStudyTopicKeys, 원래 영수증 재전송을 검증한다.
실제 Handler 응답의 오류·캐시·색인 헤더를 확인하고 공개 /api/search 응답에 study 자료가 없는지도 검사한다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
RUN_DB_TESTS=1 pnpm exec vitest run 'src/app/api/study/v1/recommendation-routes.test.ts'
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
| `src/app/api/study/v1/candidates/route.ts` | 신규 또는 기존 내용 확장 |
| `src/app/api/study/v1/recommendation-runs/` | 명시한 하위 파일 생성 또는 이동 |
| `src/app/api/study/v1/publications/route.ts` | 신규 또는 기존 내용 확장 |
| `src/app/api/study/v1/imports/` | 명시한 하위 파일 생성 또는 이동 |
| `src/app/api/study/v1/recommendation-routes.test.ts` | 신규 또는 기존 내용 확장 |
