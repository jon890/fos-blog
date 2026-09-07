# Phase 03. 공개 레이아웃과 관리자 응답 분리

**Execution profile**: standard

## 목표

관리자 화면에 광고와 공개 탐색 요소가 상속되지 않도록 공개 화면을 route group으로 옮긴다.

**범위 외**: 공부 화면과 자료 조회는 plan062 책임이다. 공개 URL과 공개 콘텐츠는 바꾸지 않는다.

## 컨텍스트

선행 plan은 없다. 기존 계획 문서가 포함된 브랜치에서 시작한다. plan061·064·062는 이 plan 뒤에 실행한다.
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

### 1. 공개 화면 이동

코드 아키텍처의 공개 레이아웃 이동 표에 있는 경로만 `src/app/(blog)/` 아래로 옮긴다.
대상은 page.tsx·loading.tsx와 about·contact·privacy·glossary·categories·category·posts·series·tag 폴더다.
폴더 내부 CSS·테스트·categories OG 파일도 함께 옮기고 상대 import를 보정한다.
루트 not-found·opengraph-image·components와 api·sitemap·robots·RSS·아이콘 경로는 유지한다.
루트 layout에는 html/body·글꼴·테마·Toaster를 남기고 공개 Header·SidebarProvider·Sidebar·Footer와 광고를 `(blog)/layout.tsx`로 옮긴다.

### 2. 관리자 공통 응답

`src/app/admin/layout.tsx`에 관리자 metadata와 단순 화면 틀을 둔다. 이 layout은 로그인도 포함하므로 세션을 필수로 요구하지 않는다.
개인 HTML·RSC·오류의 private no-store와 X-Robots-Tag를 `next.config.ts`의 경로별 headers와 Handler 응답에서 보장한다.
관리자 robots는 noindex/nofollow이고 공개 canonical과 OG 이미지 상속을 제거한다.
Next.js가 최종 캐시 헤더를 바꿀 수 있으므로 build/start HTTP 응답을 실제로 확인한다.
관리자 화면을 sitemap·공개 검색·방문 통계에 넣지 않고 기존 Proxy 인증 책임을 확대하지 않는다.

### 3. 공개 회귀 테스트

`src/app/layout.test.tsx`와 `src/app/admin/layout.test.tsx`에서 공개 장식·광고와 관리자 분리를 검증한다.
이동 전후 공개 URL별 canonical·robots·광고를 비교하고 기존 이동한 page 테스트를 실행한다.
빌드 후 공개 홈·글·about과 관리자 HTML/RSC 오류 응답의 headers 및 광고 미포함을 확인한다.
검증 브라우저는 지정된 browser-driver의 종료 코드와 DOM 결과로 판정한다.

## 검증

명령은 현재 구현 worktree의 저장소 root에서 실행한다.
대상 테스트, lint, type-check, 전체 test, build가 모두 종료 코드 0이어야 한다.
DOM 테스트 파일은 `// @vitest-environment jsdom`을 선언한다.
실DB 테스트는 기본 단위 테스트와 구분하지만 이 phase가 요구한 DB 근거를 생략하지 않는다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
pnpm exec vitest run 'src/app/layout.test.tsx' 'src/app/admin/layout.test.tsx'
pnpm lint
pnpm type-check
pnpm test
pnpm build
pnpm start --port 3063
# 별도 터미널에서 실행하며 검증 뒤 위 서버를 종료한다.
curl -sS -D - http://127.0.0.1:3063/admin/login -o /dev/null
curl -sS -D - -H 'RSC: 1' http://127.0.0.1:3063/admin/login -o /dev/null
curl -sS -D - http://127.0.0.1:3063/admin/not-found-fixture -o /dev/null
ORCA_WORKTREE="path:$PWD" ~/.claude/scripts/browser-driver open http://127.0.0.1:3063/admin/login
# open이 반환한 핸들을 아래 <handle>에 대입한다.
~/.claude/scripts/browser-driver worktree <handle>
~/.claude/scripts/browser-driver js <handle> '({robots:document.querySelector("meta[name=robots]")?.content,canonical:document.querySelector("link[rel=canonical]")?.href,ads:document.querySelectorAll("script[src*=googlesyndication],meta[name=google-adsense-account],ins.adsbygoogle").length})'
git diff --check
```

통과하면 현재 phase의 검증 결과를 기록하고 다음 phase로 진행한다.

HTTP 세 응답은 `Cache-Control`에 `private`와 `no-store`, `X-Robots-Tag`에 `noindex`와 `nofollow`가 있어야 한다.
관리자 DOM은 robots가 `noindex, nofollow`, canonical이 없고 광고 요소 수가 0이어야 한다.
같은 브라우저의 `nav <handle> <url>`과 `js`로 공개 홈·fixture 글·about의 기존 canonical·robots·광고 설정이 유지됨을 확인한다.
실행 서버에는 fixture 환경과 격리 DB만 주입한다. phase04 구현 전 로그인 페이지의 404도 동일한 응답 헤더를 확인한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `src/app/layout.tsx` | 신규 또는 기존 내용 확장 |
| `src/app/layout.test.tsx` | 신규 또는 기존 내용 확장 |
| `src/app/(blog)/` | 명시한 하위 파일 생성 또는 이동 |
| `src/app/admin/layout.tsx` | 신규 또는 기존 내용 확장 |
| `src/app/admin/layout.test.tsx` | 신규 또는 기존 내용 확장 |
| `next.config.ts` | 신규 또는 기존 내용 확장 |
