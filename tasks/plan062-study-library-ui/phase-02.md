# Phase 02. 자료 페이지와 상태 충돌 복구

**Execution profile**: standard

## 목표

자료 검색·필터·더 보기와 개인 상태 저장을 실제 API에 연결한다.

**범위 외**: 추천·가져오기 화면은 뒤 phase다. API DTO와 인증 설정을 바꾸지 않는다.

## 컨텍스트

plan063 → plan061 → plan064 완료 코드가 현재 브랜치에 있어야 한다. 이 plan은 공개 레이아웃을 다시 이동하지 않고 완성된 관리자 인증과 HTTP API를 사용한다.
이 plan의 phase-01 완료 코드 위에서 실행한다.
현재 작업은 한 저장소의 구현 worktree에서만 수행하며 다른 작업자의 변경을 되돌리지 않는다.

**근거 문서**: [요구사항](../../docs/prd.md#공통-관리자와-개인-학습자료-요구), [관리자 인증 설정](../../docs/code-architecture.md#관리자-인증-허용-계정-판정), [HTTP 계약](../../docs/api/study-library.md), [저장 계약](../../docs/data-schema.md), [흐름](../../docs/flow.md), [모듈 배치](../../docs/code-architecture.md).

## 의도 메모

- 공개 posts 모델과 study 자료를 합치지 않는다. 서비스 토큰과 관리자 세션의 권한을 분리한다.
- 실제 계정 ID·secret·운영 호스트는 환경으로만 주입한다. 테스트와 문서에 실제 값을 넣지 않는다.
- 기존 Repository와 UI를 재사용하고 승인된 Better Auth·Drizzle patch 외의 직접 의존성을 추가하지 않는다.

## Blocked 조건

선행 코드가 없으면 `PHASE_BLOCKED: 선행 plan 또는 phase 코드 없음`으로 보고한다.
이 phase의 단위·DOM·레이아웃 검증에는 TEST_DATABASE_URL을 필수로 요구하지 않는다.
운영 DB와 배포를 대신 실행하거나 테스트 성공을 추정하지 않는다.

## 작업 항목

### 1. 서버 페이지와 요청 상태

`src/app/admin/(protected)/study/page.tsx`, `loading.tsx`, `error.tsx`를 만든다.
페이지 자체에서도 requireAdminPage를 호출한다.
`src/components/study/StudyLibrary.tsx`가 URL query와 cursor 목록 상태를 관리하고 /materials와 /sources를 호출한다.
검색 제출·필터 변경 시 cursor와 누적 목록을 초기화하고 느린 이전 응답은 요청 식별자로 무시한다.
한국 날짜 입력은 종료 다음 날을 포함한 UTC 반열린 구간으로 변환한다.

### 2. 저장과 복구

PATCH state 성공에 서버 전체 state를 반영한다.
409 또는 응답 유실이면 GET /materials/{id}로 최신 상태를 조회하고 메모 초안을 유지해 다시 시도하게 한다.
401은 저장 성공으로 보이지 않게 하고 재로그인 안내를 제공한다.
빈 목록·검색 결과 없음·조회 장애를 구분하고 더 보기 재시도는 같은 cursor를 사용한다.
AdminNavigation의 공부 메뉴를 활성화한다.

### 3. 페이지 연결 테스트

`StudyLibrary.test.tsx`에서 필터를 빠르게 바꿔 이전 응답이 새 결과를 덮지 못하는지 확인한다.
새 자료 유입 중 더 보기, 날짜 null 포함·제외, 409 후 단건 최신 상태와 편집 초안 유지, 응답 유실 뒤 재조회와 401을 검증한다.
`src/app/admin/study-page.test.tsx`에서 layout 결과와 무관한 page 세션 재검증을 확인한다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
pnpm exec vitest run 'src/components/study/StudyLibrary.test.tsx' 'src/app/admin/study-page.test.tsx'
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
| `src/app/admin/(protected)/study/page.tsx` | 신규 또는 기존 내용 확장 |
| `src/app/admin/(protected)/study/loading.tsx` | 신규 또는 기존 내용 확장 |
| `src/app/admin/(protected)/study/error.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/study/StudyLibrary.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/study/StudyLibrary.test.tsx` | 신규 또는 기존 내용 확장 |
| `src/app/admin/study-page.test.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/admin/AdminNavigation.tsx` | 신규 또는 기존 내용 확장 |
