# 코드 아키텍처

## 학습자료 모듈

**구현 전 확정 배치다.** 인증, 저장·수집, 추천·가져오기, 공부 UI 순으로 구현한다.
서비스 책임과 DTO는 [학습자료 API](./api/study-library.md), 테이블은
[학습자료 저장 계약](./data-schema.md#학습자료-저장-계약)을 따른다.
다음 경로는 기존 코드 위치를 확인한 뒤 정한 생성 예정 경로다.

| 경로 | 책임 |
| --- | --- |
| `src/lib/study/contracts.ts` | Zod 입력 스키마, 브라우저와 서버에서 쓰는 DTO·enum |
| `src/lib/study/url-identity.ts` | career-os와 같은 URL 정규화와 contentKey 계산, 고정 fixture 검증 |
| `src/lib/admin/auth.ts` | Better Auth 설정과 GitHub numeric ID 검증 |
| `src/lib/admin/session.ts` | DB 세션과 현재 허용 GitHub 계정 재검증, page/API용 판정 |
| `src/lib/admin/client.ts` | Better Auth React client. 로그인과 로그아웃만 호출 |
| `src/infra/db/schema/auth.ts` | Better Auth user/session/account/verification 모델 |
| `src/app/api/auth/[...all]/route.ts` | 허용한 Better Auth endpoint만 Next.js Handler로 전달 |
| `src/lib/study/auth.ts` | 공통 관리자 세션 또는 별도 서비스 Bearer를 판정하고 API 권한 분리 |
| `src/lib/study/http.ts` | 본문 크기, Origin, 권한, 오류 변환, 개인 응답 헤더 |
| `src/infra/db/schema/study.ts` | study 테이블과 FK, 인덱스, 타입 |
| `src/infra/db/repositories/StudyRepository.ts` | 자료·소스·개인 상태 조회와 DB 쓰기, 트랜잭션 실행 인터페이스 |
| `src/services/study/ingestion.ts` | cursor와 자료·영수증 원자적 저장 |
| `src/services/study/sources.ts` | 소스 전체 교체와 version 비교, cursor 두 행 초기화 |
| `src/services/study/materials.ts` | 개인 자료 조회와 상태 갱신 조합 |
| `src/services/study/recommendations.ts` | 후보 조회, 누적 중복 검증, 추천·게시 이력 |
| `src/services/study/imports.ts` | dry-run과 commit 재검증, 과거 이력 보존 |
| `src/app/api/study/v1/` | API 문서의 경로별 Route Handler. 인증·검증 후 서비스 호출 |
| `src/app/admin/login/page.tsx` | 로그인 시작과 실패 안내. 세션 필수 layout 밖에 배치 |
| `src/app/admin/(protected)/layout.tsx` | 관리자 세션 확인, 본인 계정 표시, 공부 메뉴와 로그아웃 |
| `src/app/admin/(protected)/page.tsx` | 관리자 홈. 최초에는 공부 화면 링크만 제공 |
| `src/app/admin/(protected)/study/` | 자료와 추천·가져오기 페이지 조합, loading/error 상태 |
| `src/components/study/` | `StudyFilters`, `MaterialList`, `MaterialCard`, `MaterialStateEditor`, `RecommendationDetail`, `ImportPanel` |
| `src/components/admin/` | `AdminLoginButton`, `AdminNavigation`, `AdminSignOutButton` |

읽기 메서드는 `listMaterials`, `getMaterial`, `listCandidates`, `listRecommendationRuns`, `getRecommendationRun`이다.
쓰기 서비스는 `ingestBatch`, `saveRecommendationRun`, `recordPublication`, `previewImport`, `commitImport`다.
소스 서비스는 `putSource`, `listSources`, `getSourceCursor`, 개인 상태 서비스는 `updateMaterialState`다.
입력과 반환 타입은 HTTP 문서의 해당 DTO를 사용하고 브라우저 DTO에 DB 인스턴스를 포함하지 않는다.
서비스 입력 타입은 해당 요청 이름 뒤에 `Input`, 출력은 `Result`를 붙여 `contracts.ts`에 둔다.
예를 들어 `ingestBatch(input: IngestBatchInput): Promise<IngestBatchResult>`는 배치 요청과 영수증을 대응시킨다.
page와 Handler는 검증된 주체를 별도 인자로 전달하며 입력 payload에서 owner를 만들지 않는다.
여러 Repository나 트랜잭션 흐름을 Route Handler에 흩어 놓지 않는다.
Repository 내부 트랜잭션의 DB 객체를 관련 쿼리에 전달하며 전역 연결로 빠져나가지 않는다.

`getRepositories()`에 `study`를 추가하되 `React.cache()`의 요청 내 재사용만 유지한다.
개인 자료에는 `unstable_cache`와 ISR을 사용하지 않는다.
공개 검색 API는 개인 자료를 합치지 않으며 `posts.isActive` 정책도 바꾸지 않는다.
서버 로그에는 operation, requestId, 성공 여부와 개수만 기록한다.
DB 공용 연결의 개발 SQL parameter 로그는 개인 값 노출을 막도록 끈다.
오류 응답과 로그에 토큰·메모·본문·DB 연결 문자열을 넣지 않는다.

### 공개 레이아웃 분리

현재 루트 레이아웃은 광고 스크립트와 공개 Header·Sidebar·Footer를 렌더링한다.
개인 화면에서 이 부수 효과를 제거하려면 plan063에서 공개 화면을 `(blog)` route group으로 옮긴다.
루트에는 html/body, 공통 글꼴·테마·Toaster만 남기고 공개 장식과 광고는 `(blog)/layout.tsx`로 이동한다.
관리자 페이지는 `admin/(protected)/layout.tsx`에서 공통 인증과 내비게이션을 조합한다.
각 페이지와 API도 서버에서 권한을 확인하며 layout의 이전 렌더 결과를 인증 근거로 재사용하지 않는다.
로그인 페이지는 `(protected)` 밖에 두어 리디렉션 반복을 막는다.
이 이동은 URL을 바꾸지 않으며 공개 페이지별 metadata와 상대 import를 회귀 검증한다.
이동 대상은 아래 표로 고정하며 폴더 내부의 테스트와 CSS도 같이 옮긴다.

| 현재 `src/app/` 아래 경로 | 이동 대상 |
| --- | --- |
| `page.tsx`, `loading.tsx` | `(blog)/page.tsx`, `(blog)/loading.tsx` |
| `about/`, `contact/`, `privacy/`, `glossary/` | `(blog)/` 아래 같은 폴더 |
| `categories/`, `category/`, `posts/`, `series/`, `tag/` | `(blog)/` 아래 같은 폴더. categories OG 파일은 원래 경로 유지 |

`api`, sitemap, robots, RSS, 아이콘 등 Route Handler와 metadata 파일은 임의로 이동하지 않는다.
루트 `not-found.tsx`, `opengraph-image.tsx`, `components/FolderSidebarWrapper.tsx`는 원래 경로에 둔다.
categories OG 특수파일을 route group 안으로 옮기면 Next.js가 공개 URL에 해시를 붙이므로 원래 경로를 유지한다.
루트 404의 metadata에는 noindex/nofollow와 빈 OG·Twitter images를 명시해 관리자 오류 응답의 공개 이미지 상속을 막는다.
관리자 metadata는 noindex를 명시하고 공개 canonical·OG 이미지 상속을 제거한다.
공개 글 이동 전 각 URL, canonical, robots와 광고 요소를 기록하고 이동 뒤 같은 값인지 검사한다.
`src/app/globals.css`의 기존 `@source`가 study 컴포넌트를 포함하는지 검증한다.

### 관리자 인증: 버전과 공식 근거

2026-09-07 npm registry의 latest와 배포 tarball의 타입·실행 코드를 확인했다.
아래 버전을 구현 기준으로 고정하고 실행 시 lockfile의 실제 해석 버전을 함께 검사한다.
2026-09-07 사용자 승인은 Better Auth와 필요한 Drizzle 호환 patch를 포함한다.

| 대상 | 확인 결과와 선택 |
| --- | --- |
| `better-auth` | latest `1.7.3`. 이 버전을 직접 의존성으로 추가 |
| `@better-auth/core`, `@better-auth/drizzle-adapter` | Better Auth가 `1.7.3`을 의존. 별도 직접 의존성 추가 불필요 |
| `drizzle-orm` | 현재 선언 `^0.45.1`, 인증 peer는 `^0.45.2`. 승인된 patch `0.45.2`로 최소 버전 상향 |
| `drizzle-kit` | 현재 `^0.31.8`, 인증 peer `>=0.31.4` 충족. 변경 불필요 |
| Next.js, React, mysql2 | 현재 16·19·3 버전 계열이 인증 peer 범위를 충족 |
| 전이 의존성 | Better Auth의 jose 등은 허용된 패키지 설치에 수반된다. 별도 Cloudflare Access나 직접 jose 인증 구현은 하지 않음 |

공식 [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)는 MySQL provider와 schema 매핑을 지원한다.
`better-auth/adapters/drizzle`에서 가져온 `drizzleAdapter`에 기존 DB와 `provider: "mysql"`을 전달한다.
adapter의 `transaction: true`를 명시하고 동일 연결의 MySQL 트랜잭션 지원을 실제 DB 테스트로 증명한다.
`@better-auth/drizzle-adapter@1.7.3`의 `dist/index.d.mts`에서 이 옵션의 기본값이 false임을 확인했다.
직접 OAuth·세션을 구현하는 대안은 state·쿠키·철회를 직접 유지해야 하므로 기각했다.
Auth.js는 가능하지만 승인된 Better Auth와 중복 도입하지 않는다.
실제 의존성 변경은 후속 구현에서 `package.json`과 `pnpm-lock.yaml`을 함께 커밋한다.

타입 확인은 `@better-auth/core@1.7.3`의 `dist/types/init-options.d.mts`를 사용했다.
실행 경로는 `better-auth@1.7.3`의 다음 파일에서 확인했다.

| 파일 | 검증한 동작 |
| --- | --- |
| `dist/db/internal-adapter.mjs` | user 생성 전에 validateUserInfo 실행 |
| `dist/oauth2/link-account.mjs` | 연결 전 검사와 기존 OAuth sign-in의 fresh profile 검사 |
| `dist/api/routes/callback.mjs` | 명시적 연결 callback에서도 link-account 검사 |
| `dist/utils/validate-user-info.mjs` | error 객체와 예외를 거절로 처리 |

재현 명령은 `npm view better-auth@1.7.3 peerDependencies dependencies --json`과
`npm view @better-auth/drizzle-adapter@1.7.3 peerDependencies --json`이다.
배포 타입 원문은 [npm core tarball](https://registry.npmjs.org/@better-auth/core/-/core-1.7.3.tgz),
실행 코드는 [npm Better Auth tarball](https://registry.npmjs.org/better-auth/-/better-auth-1.7.3.tgz)로 재확인한다.

### 관리자 인증: 허용 계정 판정

권한 기준은 GitHub의 변경되지 않는 numeric user ID 하나다.
`ADMIN_GITHUB_USER_ID`는 `[1-9][0-9]*` 형식의 문자열 하나만 받으며 빈 값·쉼표 목록은 허용하지 않는다.
GitHub 사용자명, 이메일, 조직명과 첫 사용자 여부는 권한 근거로 쓰지 않는다.

`user.validateUserInfo`의 입력은 `{user, source}`이며 허용은 반환값 없음, 거절은 `{error}`다.
`source.action`은 `create-user`, `link-account`, `sign-in`이다.
원본 GitHub ID는 `source.oauth.profile.id`에서 읽고 `user.id`는 로컬 사용자 ID일 수 있으므로 비교하지 않는다.
이 계약은 [공식 callback 설명](https://better-auth.com/docs/concepts/users-accounts#callbacks)과 배포 타입에서 함께 확인했다.

판정 순서는 다음과 같다.

1. `source.method !== "oauth"` 또는 `source.oauth.providerId !== "github"`이면 거절한다.
2. `source.action === "link-account"`이면 허용 ID라도 거절한다.
3. profile.id가 안전 범위의 양의 정수이면 10진 문자열로 바꾼다. 이미 문자열이면 같은 숫자 형식인지 검사한다.
4. 누락·비정수·안전 범위 밖 number와 현재 환경 ID 불일치는 `admin_account_not_allowed`로 거절한다.
5. 허용 ID의 신규 생성과 재로그인만 통과시킨다. 실제 ID를 오류·로그·문서에 넣지 않는다.

`socialProviders`에는 github만 등록하고 `emailAndPassword.enabled: false`,
`account.accountLinking.enabled: false`를 명시한다.
`user.changeEmail.enabled`, `user.deleteUser.enabled`도 false로 유지하고 관리자 plugin을 설치하지 않는다.
신규 가입을 통째로 끄면 본인의 최초 OAuth 계정도 생성되지 않으므로 생성 자체는 위 hook으로 제한한다.
UI를 숨기는 것에 그치지 않고 노출 endpoint를 제한한다.

### 관리자 인증: 세션과 매 요청 재검증

세션은 MySQL에 저장하고 쿠키에는 라이브러리가 만든 opaque token을 사용한다.
정책은 `expiresIn: 604800`, `disableSessionRefresh: true`, `cookieCache.enabled: false`다.
로그인 뒤 7일이 지나면 다시 GitHub 인증을 하며 활동으로 유효기간을 늘리지 않는다.
이 설정은 [공식 세션 관리](https://better-auth.com/docs/concepts/session-management)의 옵션을 사용한다.

`auth.api.getSession({headers, query:{disableCookieCache:true}})`로 DB 세션을 확인한 다음,
그 userId의 GitHub accountId를 읽어 현재 `ADMIN_GITHUB_USER_ID`와 비교한다.
이 검사를 protected layout, 각 관리자 page, 관리자용 API가 모두 호출한다.
Proxy, RSC 캐시, 클라이언트 상태나 오래된 layout 결과를 권한 근거로 사용하지 않는다.
DB 장애는 세션 없음으로 처리하지 않고 page 오류 또는 API `503`으로 알린다.
허용 계정 설정이 바뀌거나 account 행이 사라지면 기존 세션도 다음 요청에서 `403`으로 거절한다.

로그아웃은 현재 session을 서버에서 철회하고 쿠키를 삭제한다.
다른 기기의 세션을 끊으려면 후속 운영 작업에서 해당 세션을 철회한다. 이번 UI에는 세션 관리 화면을 추가하지 않는다.
설정 변경의 적용 시점은 새 환경으로 재시작한 인스턴스다. 변경 전 프로세스에 새 env가 자동 전파된다고 가정하지 않는다.
브라우저 쿠키는 HttpOnly, SameSite=Lax, Path=/이며 운영 HTTPS에서 Secure를 강제하고 Domain 공유를 켜지 않는다.
로컬 HTTP 개발에서만 Secure 예외를 허용하며 실제 운영값으로 로컬 테스트하지 않는다.

### 관리자 인증: 환경 설정과 자격증명 부재

| 서버 환경 변수 | 용도와 검증 |
| --- | --- |
| `BETTER_AUTH_URL` | 한 개의 origin. 운영은 HTTPS, 로컬 개발은 loopback HTTP 허용 |
| `BETTER_AUTH_SECRET` | 최소 32바이트 난수. 세션 서명용 서버 비밀값 |
| `GITHUB_CLIENT_ID` | 관리자 OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | 관리자 OAuth App secret |
| `ADMIN_GITHUB_USER_ID` | 허용할 GitHub numeric ID 문자열 하나 |
| `STUDY_SERVICE_TOKEN` | career-os 전용 Bearer. 관리자 로그인에서 사용 금지 |

관리자 env는 서버 스키마에 선택 문자열로 선언하되 형식·완전성과 DB 설정은 인증 초기화 때 검증한다.
아무 값도 없으면 공개 블로그는 계속 동작하고 관리자 기능은 설정 필요 안내, 인증·study 관리자 요청은 `503`이다.
부분 설정이나 잘못된 값은 관리자 인증을 허용하지 않는다. 서비스 토큰 부재는 서비스 인증 `401`이다.
빌드가 인증 모듈 import만으로 운영 DB에 접속하지 않도록 초기화를 지연한다.
`.env.example`에는 설명과 빈 자리만 두고 실제 계정·호스트·secret은 기록하지 않는다.

### 기존 코드 재사용과 부수 효과

**판정은 가능이다.** 승인된 본인 인증과 수집기 계약을 기존 서비스 안에서 구현한다.
현재 공개 블로그의 글 모델은 GitHub 파일 동기화에 맞춰져 있으므로 학습자료에는 사용하지 않는다.

| 확인한 코드 | 재사용 범위 | 부수 효과와 대응 |
| --- | --- | --- |
| [DB 연결](../src/infra/db/index.ts) | MySQL 연결과 Drizzle | 개발 모드 SQL 로그에 개인 정보가 남지 않도록 조정 필요 |
| [Repository 팩터리](../src/infra/db/repositories/index.ts) | 요청 범위 인스턴스 재사용 | 개인 응답을 공유 캐시에 넣지 않음 |
| [글 스키마](../src/infra/db/schema/posts.ts) | 재사용하지 않음 | 경로 기반 글 식별과 동기화 비활성화 정책을 자료와 분리 |
| [루트 레이아웃](../src/app/layout.tsx) | 테마, 글꼴과 알림 | 개인 화면에서 광고 스크립트와 공개 탐색 UI 분리 필요 |
| [Proxy](../src/proxy.ts) | 정상 Next.js 16 진입점 유지 | API는 현재 matcher 제외이므로 Handler 자체 인증 필요 |
| [방문 기록](../src/middleware/visit.ts) | 공개 글 동작 유지 | 학습자료 경로를 방문 집계에 추가하지 않음 |
| [검색 API](../src/app/api/search/route.ts) | 공개 글 검색 유지 | 개인 자료는 별도 API에서 조회 |
| [환경 계약](../src/env.ts) | Zod 기반 서버 설정 | 인증 정보는 서버 설정으로만 추가 |

### 검증용 의존성 주입

인증 생성 함수 `createAdminAuth(db, config)`는 DB와 검증된 설정을 받아 테스트 DB로도 구성할 수 있다.
운영 진입점은 서버 env와 기존 DB 팩터리로만 생성하며 인증 우회 플래그나 테스트 전용 HTTP endpoint를 넣지 않는다.
`src/infra/db/test-utils.ts`는 `TEST_DATABASE_URL`의 loopback 호스트와 `fos_blog_test_` DB 이름을 검사한다.
검증용 MySQL에만 마이그레이션을 적용하고 테스트가 만든 데이터만 정리한다.
일반 `DATABASE_URL`을 테스트 쓰기에 대신 사용하지 않는다.
실DB 검증을 실행할 때 설정이 없으면 성공으로 건너뛰지 않고 검증 불가로 보고한다.
기본 `pnpm test`에서 실DB 테스트를 선택 실행하도록 하되 해당 phase 검증에서는 `RUN_DB_TESTS=1`로 명시적으로 실행한다.
테스트는 소스 옆 `*.test.ts` 또는 `*.test.tsx`에 두고 DOM 테스트만 jsdom 환경을 지정한다.
브라우저 검증은 격리 DB에 발급한 정상 테스트 세션을 사용하고 실제 운영 계정·secret을 fixture에 기록하지 않는다.

**갱신일:** 2026-07-30
**관련 문서:** [PRD](./prd.md) · [흐름](./flow.md) · [데이터 스키마](./data-schema.md) · [ADR](./adr/README.md)

## 시스템 경계

fos-blog는 GitHub의 마크다운 콘텐츠를 MySQL로 동기화하고 Next.js App Router로 제공한다.
운영 환경은 홈서버의 Docker 컨테이너이며 Next.js standalone 출력을 사용한다.

```text
app
  ↓
services
  ↓
infra/db · infra/github
  ↑
lib
```

- `app`은 라우팅, 메타데이터, 화면 조합을 담당한다.
- `app`은 목표 구조에서 `infra`를 직접 가져오지 않고 `services`를 거친다.
- `services`는 조회와 여러 Repository 조합, 외부 부수 효과가 있는 흐름을 담당한다.
- `infra`는 MySQL과 GitHub API를 캡슐화한다.
- `lib`는 마크다운 전처리, 경로, 로깅과 범용 계산을 제공한다.
- `components`는 Repository를 생성하거나 DB에 직접 접근하지 않는다.

### 현재 코드의 레이어 이탈

현재 여러 페이지와 Route Handler가 `getRepositories()`를 직접 가져온다.
홈, 카테고리, 글·태그·시리즈 목록과 댓글·검색·방문 API가 대표적이다.

이는 실제 구현을 숨기지 않기 위해 기록한 코드 부채이며 새 코드의 허용 규칙이 아니다.
새 흐름은 서비스 경계를 사용하고, 기존 직접 접근은 동작을 고정하는 테스트와 함께 별도 리팩터링으로 옮긴다.

## 주요 디렉터리

| 경로 | 책임 |
| --- | --- |
| `src/app/` | 페이지, Route Handler, 메타데이터, OG 이미지 |
| `src/components/` | 재사용 UI와 클라이언트 상호작용 |
| `src/services/` | 동기화, 용어집, RSS, 통계 같은 도메인 흐름 |
| `src/infra/db/` | Drizzle 스키마, DB 연결, Repository |
| `src/infra/github/` | GitHub API와 콘텐츠 파일 처리 |
| `src/lib/` | 공용 유틸리티와 마크다운 기반 기능 |
| `src/middleware/` | 방문 기록과 요청 제한 |
| `src/proxy.ts` | 요청 제한과 방문 기록 조합 |
| `scripts/` | 마이그레이션 등 독립 실행 작업 |
| `drizzle/` | 배포 환경에서 적용할 마이그레이션 |

## Repository 경계

`getRepositories()`는 React `cache()`로 요청 안에서 Repository 인스턴스를 재사용한다.
서비스가 Repository를 구성할 때 사용하며, 현재는 위에 기록한 레이어 이탈 코드에서도 직접 호출한다.

| Repository | 주요 책임 |
| --- | --- |
| `PostRepository` | 글, 검색, 태그, 시리즈, 관련 글 |
| `CategoryRepository` | 카테고리 집계와 탐색 |
| `FolderRepository` | 폴더와 README 메타데이터 |
| `CommentRepository` | 댓글 생성, 수정, 삭제 |
| `VisitRepository` | 방문 기록과 인기 글 통계 |
| `SyncLogRepository` | GitHub 동기화 결과 기록 |
| `GlossaryRepository` | 용어 정의와 언급 역참조 |

DB 구조와 제약의 단일 소스는 `src/infra/db/schema/`다.
사람이 읽는 스키마 설명은 [data-schema.md](./data-schema.md)가 담당한다.

## 콘텐츠 동기화

```text
/api/sync
  → syncGitHubToDatabase
  → SyncService
      → GitHub 변경 비교
      → GlossarySyncService
      → PostSyncService
      → MetadataSyncService
      → SyncLogRepository
```

- `/api/sync`는 `SYNC_API_KEY` Bearer 인증을 확인한다.
- `SyncService`는 GitHub HEAD와 마지막 성공 커밋을 비교해 전체 또는 증분 동기화를 선택한다.
- 글 변경이 없어도 제목과 요약 파생 필드, README 메타데이터, 용어집 역참조를 다시 계산할 수 있다.
- 삭제된 글은 `posts.is_active`를 이용해 비활성화한다.
- 같은 GitHub 상태를 반복 처리해도 글이 중복되거나 유실되지 않아야 한다.
- `PostSyncService`는 `thumbnail` 앞표지의 상대 경로를 검증한 GitHub raw URL로 바꿔 `posts.thumbnail_url`에 저장한다.
- `thumbnail` 누락이나 잘못된 값은 글 동기화를 막지 않고 `NULL`로 저장한다.

## 페이지 조회

현재 페이지는 Repository 직접 호출과 서비스 위임이 혼재한다.
목표 구조와 현재 이탈은 “시스템 경계”에 기록한다.
페이지별 화면과 상태는 `docs/pages/` 문서가 담당한다.

| 라우트 | 책임 문서 |
| --- | --- |
| `/` | `docs/pages/home.md` |
| `/about` | `docs/pages/about.md` |
| `/categories` | `docs/pages/categories.md` |
| `/category/[...path]` | `docs/pages/category-detail.md` |
| `/contact` | `docs/pages/contact.md` |
| `/glossary` | `docs/pages/glossary.md` |
| `/posts/[...slug]` | `docs/pages/post-detail.md` |
| `/posts/latest` | `docs/pages/posts-latest.md` |
| `/posts/popular` | `docs/pages/posts-popular.md` |
| `/privacy` | `docs/pages/privacy.md` |
| `/series` | `docs/pages/series-index.md` |
| `/series/[name]` | `docs/pages/series-detail.md` |
| `/tag/[name]` | `docs/pages/tag.md` |

각 페이지는 자체 `revalidate`와 오류·빈 상태를 선언한다.
실제 값은 해당 `page.tsx`와 페이지 문서를 함께 확인한다.

## API 경계

| 경로 | 책임 |
| --- | --- |
| `/api/sync` | GitHub 콘텐츠 동기화 |
| `/api/search` | 글 검색 |
| `/api/posts/latest` | 최신 글 추가 조회 |
| `/api/posts/popular` | 인기 글 추가 조회 |
| `/api/comments` | 댓글 목록과 생성 |
| `/api/comments/[id]` | 댓글 수정과 삭제 |
| `/api/visit` | 방문 기록 |
| `/api/og/category/[...path]` | 카테고리 OG 이미지 |
| `/api/og/posts/[...slug]` | 글 OG 이미지 |
| `/api/og/thumbnails/[category]` | 전용 썸네일이 없는 카드의 카테고리별 생성 이미지 |

요청과 응답 형식은 Route Handler의 타입과 테스트를 단일 소스로 삼는다.
모든 API가 Bearer 인증을 사용한다고 가정하지 않는다.

## 글 대표 이미지

```text
fos-study Markdown thumbnail
  → PostSyncService 경로 검증과 raw URL 변환
  → posts.thumbnail_url
  → PostRepository 조회 결과
  → PostThumbnail
      → 전용 URL
      → /api/og/thumbnails/<category>
      → /og-default.png
```

- `PostThumbnail`만 이미지 오류 전환을 위해 클라이언트 경계를 사용한다.
- `PostCard`는 글 도메인 안에서 `row`, `grid`, `featured` 표시 변형을 소유한다.
  인기 글은 `row`, 일반 탐색 목록은 `grid`, 홈 최근 첫 글은 `featured`를 사용한다.
- `PostsInfiniteList`는 조회 방식과 로딩 상태를 소유하고, `mode`에 따라 카드 배열과 스켈레톤 변형만 선택한다.
- `PostCard`와 목록 데이터 흐름은 서버 컴포넌트 우선 구조를 유지한다.
- 글 상세 메타데이터는 전용 URL이 있으면 이를 공유 이미지로 사용하고, 없으면 기존 글 OG 경로를 사용한다.

## 마크다운 렌더링

```text
마크다운 원문
  → unified remark 파서
  → GFM · 수식 · raw HTML
  → KaTeX · slug · Shiki 코드 강조
  → sanitize
  → 용어집 HAST 변환
  → JSX 컴포넌트 매핑
```

- `src/components/markdown/`에서 서버 런타임에 의존하는 모듈은 `import "server-only"`를 선언한다.
  타입만 내보내는 모듈은 선언하지 않는다.
- sanitize는 스크립트, 이벤트 속성과 위험한 URL을 제거한다.
- `CodeCard`, Mermaid, 용어 도움말과 이미지 확대는 컴포넌트 매핑으로 연결한다.
- 클라이언트 상태가 필요한 기능만 client island로 분리한다.

## 횡단 관심사

### 로깅과 오류

- 서버 코드는 `@/lib/logger`의 구조화 로거를 사용한다.
- 알 수 없는 오류는 `Error`로 정규화해 기록한다.
- 본문 조회 실패와 관련 글 같은 보조 기능 실패를 구분한다.

### 요청 보호

- `src/proxy.ts`는 요청 제한을 먼저 적용하고 허용된 요청의 방문 기록을 비동기로 남긴다.
- 댓글 비밀번호는 평문으로 저장하지 않는다.
- 외부 HTML은 마크다운 sanitize 경계를 통과해야 한다.

### 캐시와 갱신

- 페이지와 RSS는 각 파일의 `revalidate` 값을 사용한다.
- 동기화 후 콘텐츠 반영 지연은 해당 경로의 갱신 주기 안에서 허용한다.
- 운영 배포에 Vercel 전용 기능을 전제하지 않는다.

## 변경 규칙

- 새 페이지를 추가하면 대응하는 `docs/pages/*.md`를 함께 만든다.
- 새 페이지와 Route Handler는 Repository를 직접 가져오지 않고 서비스 경계를 사용한다.
- 스키마 변경은 Drizzle 마이그레이션과 `docs/data-schema.md`를 함께 갱신한다.
- 코드만 보고 알 수 없는 장기 결정은 ADR에 이유와 기각한 대안을 남긴다.
- 구현 함수와 응답 필드의 상세 목록을 이 문서에 복사하지 않는다.
