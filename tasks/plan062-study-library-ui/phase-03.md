# Phase 03. 추천 상세와 가져오기 검토 컴포넌트

**Execution profile**: standard

## 목표

추천 당시 내용과 현재 상태를 구분하고 과거 이력을 미리본 뒤 확정할 UI를 만든다.

**범위 외**: 페이지 연결과 브라우저 통합 검증은 마지막 phase다.

## 컨텍스트

plan063 → plan061 → plan064 완료 코드가 현재 브랜치에 있어야 한다. 이 plan은 공개 레이아웃을 다시 이동하지 않고 완성된 관리자 인증과 HTTP API를 사용한다.
이 plan의 phase-02 완료 코드 위에서 실행한다.
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

### 1. 추천 표시

`RecommendationList.tsx`, `RecommendationDetail.tsx`에 생성일·주제·업무 질문·추천 당시 자료와 게시 이력을 표시한다.
과거 null 설명은 기존 이력에 설명 없음으로 표시하고 빈 추천 실행도 정상 이력으로 보여준다.
현재 개인 state 편집에는 기존 MaterialStateEditor를 재사용한다.
제목·요약·이유는 일반 텍스트이며 HTML 또는 Markdown을 실행하지 않는다.

### 2. 가져오기 검토

`ImportPanel.tsx`는 정규화 JSON 파일만 받고 1 MiB 크기·파싱 오류를 저장 없이 표시한다.
입력 파일은 `{importKey,reports}` 자체다. 별도 dry-run `.preview.json`이나 추가 envelope는 받지 않는다.
dry-run 결과 counts/warnings, previewHash와 historyVersion을 선택 파일에 연결한다.
파일을 바꾸면 미리보기와 commit 가능 상태를 폐기하고 본인의 명시적 확정 버튼으로만 commit한다.
IMPORT_CHANGED면 새 dry-run을 요구하고 서버의 과거 반복 자료 경고를 표시한다.
파일·payload·미리보기를 localStorage에 쓰지 않는다.

### 3. 컴포넌트 테스트

`RecommendationDetail.test.tsx`, `ImportPanel.test.tsx`에서 과거 null·빈 추천·현재 state와 snapshot 구분을 검증한다.
잘못된 JSON·초과 파일·파일 변경 후 stale preview·IMPORT_CHANGED·401·commit 중복 클릭을 검증한다.
오류가 성공 안내로 바뀌지 않고 키보드로 선택·미리보기·확정이 가능해야 한다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
pnpm exec vitest run 'src/components/study/RecommendationDetail.test.tsx' 'src/components/study/ImportPanel.test.tsx'
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
| `src/components/study/RecommendationList.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/study/RecommendationDetail.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/study/RecommendationDetail.test.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/study/ImportPanel.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/study/ImportPanel.test.tsx` | 신규 또는 기존 내용 확장 |
