# Phase 04. 추천·가져오기 페이지와 기기 간 통합 검증

**Execution profile**: deep

## 목표

공부 메뉴의 모든 화면을 연결하고 두 기기의 저장·충돌·세션 흐름을 증명한다.

**범위 외**: 배포·운영 DB 적용·GitHub PR 등록과 career-os 실행 예약은 하지 않는다.

## 컨텍스트

plan063 → plan061 → plan064 완료 코드가 현재 브랜치에 있어야 한다. 이 plan은 공개 레이아웃을 다시 이동하지 않고 완성된 관리자 인증과 HTTP API를 사용한다.
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

### 1. 페이지 조합

`src/app/admin/(protected)/study/recommendations/page.tsx`, `recommendations/[reportId]/page.tsx`, `imports/page.tsx`를 만든다.
각 page에서 현재 관리자 세션을 재검증하고 해당 HTTP 조회·쓰기 계약을 연결한다.
추천 목록 더 보기·404 상세·과거 null과 가져오기 미리보기·commit 상태를 흐름 문서대로 표시한다.
각 하위 경로에 loading/error UI를 연결하고 관리자 추천·가져오기 메뉴를 활성화한다.

### 2. 완료 상태와 문서 정합성

실제 구현 파일과 동작을 기준으로 docs의 구현 전 표시를 해당 완료 범위에 맞게 갱신한다.
API 계약의 경로·DTO·멱등성과 소비 계약 위치를 유지한다.
네 plan이 정한 공개 블로그 격리와 비밀값 처리, 단일 GitHub 계정 판정이 실제 코드에서 이어지는지 점검한다.

### 3. 페이지와 브라우저 통합 테스트

`src/app/admin/study-workflow.test.tsx`에서 추천·가져오기 page의 세션 재검증과 실패·빈 상태를 검사한다.
격리 MySQL과 로컬 build/start를 사용해 PC·모바일 두 브라우저 컨텍스트의 정상 테스트 세션으로 같은 자료를 읽는다.
PC 저장 후 모바일 반영, 두 기기 동시 수정 409와 초안 유지, 추천 조회와 import 파일 변경·재미리보기·commit을 검증한다.
세션 철회·만료와 env ID 변경 후 다음 HTML/RSC/API가 거절되는지 확인한다.
관리자 응답의 광고·외부 이미지·개인 캐시 부재와 공개 홈·글·metadata·광고 유지도 확인한다.
browser-driver의 현재 README를 읽고 해당 명령의 종료 코드·DOM·HTTP 근거를 기록한다.
브라우저 검증 전 테스트 전용 관리자 세션과 fixture 자료를 격리 DB에 만들고, 검증 후 세션·자료와 테스트 DB를 제거한다.
PC 탭은 1024px 이상, 모바일 탭은 390px로 맞춘 뒤 `window.innerWidth`, 가로 overflow, 접힌 필터와 카드 열 수를 `js` 결과로 남긴다.
각 저장·충돌·가져오기 동작은 화면 안내와 API status를 함께 기록하며, 세션 철회·만료·허용 ID 변경은 HTML, RSC, API 요청이 모두 거절되는지 확인한다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
pnpm exec vitest run 'src/app/admin/study-workflow.test.tsx'
test -n "$TEST_DATABASE_URL"
RUN_DB_TESTS=1 pnpm exec vitest run 'src/infra/db/schema/auth.test.ts' 'src/infra/db/schema/study.test.ts' 'src/lib/admin/session.test.ts' 'src/app/api/auth/[...all]/route.test.ts' 'src/app/api/study/v1/storage-routes.test.ts' 'src/app/api/study/v1/recommendation-routes.test.ts' 'src/services/study/materials.test.ts' 'src/services/study/recommendations.test.ts' 'src/services/study/imports.test.ts'
pnpm lint
pnpm type-check
pnpm test
pnpm build
git diff --check
```

build/start는 격리 DB와 테스트 전용 인증 환경을 주입한 별도 프로세스로 실행한다.
`~/.claude/scripts/browser-driver doctor`가 `orca` 백엔드를 보고하는지 확인한다.
PC 탭은 기본 viewport에서 browser-driver의 `js`로 `window.innerWidth`를 기록한다.
모바일 탭은 Orca CLI의 공식 Browser Automation 명령 `orca set device --page <mobile page id> --name "iPhone 12" --worktree <현재 worktree selector> --json`을 실행하고 `ok: true`를 확인한 뒤 같은 항목을 기록한다.
`ORCA_WORKTREE`를 현재 worktree로 고정하고 이동·DOM·HTTP 조작과 대기는 browser-driver의 `nav`, `js`, `waitjs`로 수행한다.
두 탭의 화면 상태, 요청 status, cache·robots header를 JSON으로 출력하고 드라이버 종료 코드가 모두 0인지 기록한다.
세션과 환경 변경 뒤에는 고정 대기 대신 `waitjs`로 로그인 이동 또는 거절 응답을 기다린다.

이 plan의 모든 phase 검증이 통과한 뒤에만 `index.json`의 status를 `completed`로 바꾼다.
실패 또는 검증 불가는 완료로 표시하지 않는다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `src/app/admin/(protected)/study/recommendations/` | 명시한 하위 파일 생성 또는 이동 |
| `src/app/admin/(protected)/study/imports/` | 명시한 하위 파일 생성 또는 이동 |
| `src/app/admin/study-workflow.test.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/admin/AdminNavigation.tsx` | 신규 또는 기존 내용 확장 |
| `docs/prd.md` | 신규 또는 기존 내용 확장 |
| `docs/flow.md` | 신규 또는 기존 내용 확장 |
| `docs/api/study-library.md` | 신규 또는 기존 내용 확장 |
| `docs/code-architecture.md` | 신규 또는 기존 내용 확장 |
| `docs/data-schema.md` | 신규 또는 기존 내용 확장 |
