# Phase 01. 자료 필터·카드·상태 편집 컴포넌트

**Execution profile**: standard

## 목표

기기와 입력 방식에 관계없이 같은 자료 상태를 편집하는 UI를 만든다.

**범위 외**: 페이지 연결과 서버 호출은 다음 phase다. 공개 PostCard와 글 DTO는 변경하지 않는다.

## 컨텍스트

plan063 → plan061 → plan064 완료 코드가 현재 브랜치에 있어야 한다. 이 plan은 공개 레이아웃을 다시 이동하지 않고 완성된 관리자 인증과 HTTP API를 사용한다.
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

### 1. 표시와 필터

`src/components/study/StudyFilters.tsx`, `MaterialList.tsx`, `MaterialCard.tsx`를 만든다.
HTTP Material DTO와 흐름 문서의 검색·필터·발행일 null 표시를 사용한다.
모바일 한 열과 접을 수 있는 필터, 현재 필터·초기화 버튼을 제공한다.
원문은 검증된 HTTPS 새 탭 링크로 열고 원문 이미지 자동 요청이나 서버 fetch는 만들지 않는다.
디자인은 기존 DESIGN.md와 공용 UI를 재사용하고 globals.css의 @source 포함 여부를 확인한다.

### 2. 개인 상태 편집

`MaterialStateEditor.tsx`는 starred/read 원하는 최종값과 note·expectedVersion을 상위 호출부에 전달한다.
저장 중 자료별 동시 요청을 막고 성공 응답 전에는 완료로 표시하지 않는다.
충돌과 네트워크 오류에 편집 초안을 유지하고 최신 state와 나란히 판단할 정보를 제공한다.
메모는 일반 텍스트로 표시하고 localStorage·analytics·로그에 보관하지 않는다.
aria-live와 키보드 초점을 사용하고 색상만으로 상태를 구분하지 않는다.

### 3. 컴포넌트 테스트

`StudyFilters.test.tsx`, `MaterialCard.test.tsx`, `MaterialStateEditor.test.tsx`에 jsdom을 지정한다.
빈 자료·발행일 null·필터 초기화·키보드 조작·메모 HTML 문자열을 검증한다.
저장 버튼 중복 클릭 차단, 409 뒤 초안 유지, 실패와 성공 상태 안내를 검사한다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
pnpm exec vitest run 'src/components/study/StudyFilters.test.tsx' 'src/components/study/MaterialCard.test.tsx' 'src/components/study/MaterialStateEditor.test.tsx'
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
| `src/components/study/StudyFilters.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/study/StudyFilters.test.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/study/MaterialList.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/study/MaterialCard.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/study/MaterialCard.test.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/study/MaterialStateEditor.tsx` | 신규 또는 기존 내용 확장 |
| `src/components/study/MaterialStateEditor.test.tsx` | 신규 또는 기존 내용 확장 |
| `src/app/globals.css` | 신규 또는 기존 내용 확장 |
