# ADR — 기술 결정 기록

**작성일:** 2026-04-19

이 문서는 **코드/설정/git log로 자명하지 않은 기술 결정**만 기록한다. 자명한 사항(파일 위치, 함수명, 단순 구현 선택)은 제외.

---

## ADR-001. 무한 스크롤 페이지 도입 — SSR 첫 페이지 + 클라이언트 추가 로드 (하이브리드)

**Context**: 홈페이지 인기/최신 글이 6개씩만 노출되어 전체 200개 글 탐색 경로가 없음.

**Decision**: `/posts/latest`, `/posts/popular` 2개 전용 페이지를 만들고, 첫 10개는 **SSR로 렌더**, 이후는 클라이언트에서 `fetch` 기반 무한 스크롤로 로드한다.

**Alternatives Considered**:
- **통합 페이지 `/posts?tab=...`**: URL 1개로 탭 전환. 그러나 SSR 시 두 쿼리 모두 준비해야 하고, 탭별 상태 관리가 복잡.
- **Full Client-side Rendering**: 전체 리스트를 JS로 로드. SEO 손해 + FCP 느려짐.
- **페이지네이션(`?page=N`)**: 사용자가 명시적으로 페이지 이동. 무한 스크롤 대비 UX 대비 체감 느림 — 사용자 요구와 맞지 않음.

**Consequences**:
- 첫 페이지 SEO 무난 (단 페이지 자체는 `noindex` — ADR-005)
- 초기 응답 빠름, 스크롤 중 추가 데이터 끊김 없음
- 뒤로가기 시 React state가 초기화되어 **로드된 목록이 리셋**됨. Q14 결정에 따라 단순 유지, 추후 sessionStorage 복원 여지 남김

**Follow-ups**:
- 사용자가 뒤로가기 UX 불만 제기 시 sessionStorage 기반 상태 복원 추가

---

## ADR-002. 페이지네이션 방식 — 최신=Cursor, 인기=Offset (혼합)

**Context**: 무한 스크롤은 페이징 안정성이 핵심. 중간에 글이 추가/변동되어도 **중복/누락이 없어야** 함.

**Decision**:
- **최신글**: **Cursor 기반** composite key `(updatedAt, id)`
  ```
  WHERE (updated_at, id) < (:cursorUpdated, :cursorId)
  ORDER BY updated_at DESC, id DESC
  ```
- **인기글**: **Offset 기반** + 2차 정렬 키 `pagePath`
  ```
  ORDER BY visit_count DESC, page_path ASC LIMIT :n OFFSET :o
  ```

**Drivers**:
- 최신글은 `updatedAt` 동점 가능성 존재(동시 sync 배치) → cursor로만 페이징 시 누락 방지 위해 `id` 를 secondary key로 포함
- 인기글은 `visitCount` 정수 동점이 흔함 → `page_path` 2차 정렬로 안정화. Cursor 구현 시 (visit_count, page_path) 복합 비교가 복잡하고 인기 순위 변동이 느려 offset 중복 위험 낮음

**Alternatives**:
- **둘 다 offset**: 단순. 그러나 최신글은 sync 배치 동안 새 글 추가되면 경계에서 중복이 실제로 발생 (updatedAt 기준 시간이 최근인 글이 앞으로 밀림) → 기각
- **둘 다 cursor**: 이상적이지만 인기글은 합성 커서 비교 SQL이 복잡 + 성능/가독성 손해 → 기각

**Consequences**:
- 인덱스 2개 추가 필요 ([data-schema.md](./data-schema.md))
- API 응답 shape이 모드별로 다름 (`nextCursor` vs `hasMore`) — client 컴포넌트가 분기 처리

---

## ADR-003. 홈 진입 UX — 섹션 하단 CTA 버튼 (카테고리 섹션의 "모두 보기 →" 링크 패턴과 의도적 차별화)

**Context**: 홈의 카테고리 섹션은 이미 헤더 우측에 **"모두 보기 →"** 텍스트 링크를 쓴다. 인기/최신 섹션도 같은 패턴으로 통일할 수 있음.

**Decision**: 인기/최신 섹션에는 **섹션 하단 큰 CTA 버튼**을 둔다. 카테고리 섹션 패턴과 다르게 간다.

**Drivers**:
- 사용자 요청(Q16 B안): "버튼으로 한번 시도해보자"
- 카테고리는 보조 네비게이션, 글 목록은 **핵심 탐색 행동** — 더 강한 클릭 유도가 필요
- 헤더 우측 링크 패턴은 모바일 터치 타깃이 작음 (44px 미만 위험)

**Alternatives**:
- **헤더 우측 "모두 보기 →" (일관성 A안)**: 기각. 핵심 탐색 행동에는 약함.

**Consequences**:
- 홈 페이지에 두 종류 진입 패턴 공존 (카테고리=링크 / 글=버튼). 사용자 A/B 판단 후 통일 여지.

**Follow-ups**:
- 분석 지표(카테고리 "모두 보기" 클릭률 vs 글 CTA 버튼 클릭률) 비교 검토 → 추후 통일 결정

---

## ADR-004. 데이터 Fetching — API Route (Server Action / Server Components 검토 후 기각)

**Context**: 무한 스크롤의 추가 로드 API 구현 수단.

**Decision**: **API Route** (`app/api/posts/latest/route.ts`, `.../popular/route.ts`)

**Alternatives**:
- **Server Action**: 타입 안전·직렬화 자동이지만 GET 지원 안 됨 (POST만) → 브라우저/CDN 캐시 미활용 + 무한 스크롤 의미론과 어긋남
- **Server Components with `searchParams`**: URL이 갱신되며 서버에서 새 페이지 렌더. 무한 스크롤에는 맞지 않고(전체 리렌더) Q8(URL 상태 미반영) 결정과 충돌

**Consequences**:
- 표준 HTTP GET — 브라우저 devtools에서 디버깅 용이
- JSON 직렬화 경계 명시 (`Date → ISO string` 변환을 cursor 파싱 시 처리)

---

## ADR-005. SEO — 리스트 페이지 `noindex`

**Context**: 리스트 페이지는 검색엔진 기준 가치가 낮고 중복 콘텐츠 가능성이 있음 (각 글의 제목이 이미 홈/카테고리에 노출).

**Decision**: `/posts/latest`, `/posts/popular` 모두 `export const metadata = { robots: { index: false, follow: true } }`.

**Drivers**:
- 사용자 요청(직접 결정)
- 검색엔진은 개별 글 페이지(`/posts/<path>`)를 색인하도록 유도 — 리스트가 검색결과에 끼어들어 CTR을 희석하는 것 방지
- `follow: true`는 유지 — 크롤러가 리스트를 통해 개별 글까지 도달 가능

**Consequences**:
- Search Console에 "색인 생성 제외" 표시되는데 이는 의도된 동작
- 개별 글 페이지의 검색 노출에 영향 없음

---

## ADR-006. 라이브러리 — IntersectionObserver 직접 구현 (의존성 미도입)

**Context**: 무한 스크롤 트리거 구현 방법.

**Decision**: **IntersectionObserver 네이티브 API 직접 사용**. `react-intersection-observer` 같은 래퍼 미도입.

**Drivers**:
- 번들 크기 증가 0
- 10줄 내외 구현으로 충분
- 프로젝트 정책(CLAUDE.md): MVP 필요 의존성만

**Alternatives**:
- `react-intersection-observer` (~2KB gzip) — 기각. 얻는 것 대비 과함.

**Consequences**:
- 컴포넌트 내부에서 `useEffect` + `IntersectionObserver` 훅 패턴 직접 관리
- 리렌더 최적화는 `useRef`로 observer 인스턴스 고정

---

## ADR-007. OG 이미지 전략 — `next/og` 동적 생성 + 정적 fallback 하이브리드

**Context**: 소셜 공유 시 썸네일 이미지가 CTR에 큰 영향. 현재 `layout.openGraph.images` 미설정 → 공유 시 이미지 없음. `ArticleJsonLd.publisher.logo` 가 실존하지 않는 URL(`/icon`) 참조 → Rich Results 검증 실패.

**Decision**:
- **정적 fallback**: `public/og-default.png` (1200×630), `public/logo.png` (512×512) 를 자산으로 고정 배치 — `layout.tsx` metadata.openGraph/twitter.images 에 기본값, `JsonLd.tsx` publisher.logo URL 에 사용
- **동적 생성**: `next/og` `ImageResponse` 사용하여 각 페이지마다 제목/발췌/카테고리 배지가 렌더된 고유 OG 이미지 런타임 생성
- 대상 경로:
  - `src/app/opengraph-image.tsx` (홈) — metadata file convention
  - `src/app/categories/opengraph-image.tsx` — metadata file convention
  - `src/app/api/og/category/[...path]/route.tsx` — API Route (catch-all 우회, ADR-011)
  - `src/app/api/og/posts/[...slug]/route.tsx` — API Route (catch-all 우회, ADR-011)
- ISR `revalidate = 60` (metadata file), 동등한 `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=...` (API Route)

**Drivers**:
- **CTR 극대화**: 공유 시 제목이 이미지에 렌더됨 → Twitter/Facebook/Slack 미리보기에서 즉시 내용 파악
- **홈서버 호환**: Next.js 공식 API라 standalone 빌드에서 동작
- **정적 fallback 보험**: 동적 생성 실패/미구현 페이지에도 브랜드 이미지 노출

**Alternatives Considered**:
- **정적 이미지 1장만** (`og-default.png` 단독): 간단하지만 글마다 같은 이미지 → 공유 변별력 없음. 기각
- **빌드 타임 pre-render (SSG)**: 200개 OG 이미지를 빌드 시 생성. 빌드 시간 증가 + 글 수정 반영 지연. ISR 60초가 더 자연스러움. 기각

**Consequences**:
- `public/` 에 이미지 자산 2개 + 폰트 파일 1개 번들 필요
- `ImageResponse` 공용 유틸(`src/lib/og.ts`)로 스타일/폰트/로고 embedding 중앙 관리
- 동적 이미지 alt 텍스트:
  - metadata file (`opengraph-image.tsx`): `export const alt` 로 페이지별 지정
  - API Route (`route.tsx`): `ImageResponse` JSX 내 `<img alt="...">` 로 지정

**Follow-ups**:
- 빌드 후 Facebook Sharing Debugger / Twitter Card Validator / Google Rich Results Test 로 전수 검증
- 향후 다크/라이트 변형, 카테고리별 색상 테마 고려 가능

---

## ADR-008. 동적 OG 폰트 — 로컬 subset 파일 번들

**Context**: `ImageResponse` 로 한글 렌더 시 폰트 지정 필수. 외부 CDN(Google Fonts) fetch는 홈서버에서 네트워크 의존성 + 실패 시 렌더 불가.

**Decision**: **Noto Sans KR Bold** 를 Unicode Hangul Syllables 블록 전체(`U+AC00-D7A3`, 11,172자) + ASCII 로 **subset 한 TTF 파일을 `public/fonts/` 에 번들**.
- subset 스크립트: `scripts/build-og-fonts.py` (pyftsubset 기반) — 재현 가능
- 결과물: `public/fonts/NotoSansKR-Bold-subset.ttf` (목표 ~1.6MB, 한도 2MB)
- `ImageResponse` 는 Node `fs.readFile` 로 로컬 파일 로드 후 `fonts` 옵션에 전달

**Drivers**:
- 홈서버 외부의존성 제거 (네트워크 장애 시에도 OG 이미지 정상 생성)
- **모든 한글 렌더 보장** — KS X 1001 2350자로 제한하면 최신 합성 음절(ㅆ, ㅎ 이중받침 조합 등) 누락 위험. Unicode 한글 음절 블록 전체로 풀 렌더
- **포맷은 TTF 고정** — Next.js `ImageResponse.fonts`는 TTF/OTF/WOFF 만 지원, **WOFF2 미지원**. subset 결과는 TTF로 저장해야 `ImageResponse`가 로드 가능 (공식 satori 제약)
- 원본 대비 subset 으로 불필요 글리프 제거 (번들 경량화 효과는 WOFF2 대비 제한적이나 "모든 한글 렌더 + 서버 전용 asset" 원칙이 우선)
- 스크립트로 재생성 가능 → Noto 업데이트 시 커맨드 1회 실행

**Alternatives Considered**:
- **woff2 subset**: ~577KB 로 훨씬 작지만 `ImageResponse.fonts` 미지원. 기각
- **woff subset**: TTF 대비 ~50% 작으나 satori 구버전 호환성 불확실 + TTF 대비 실익 적음. 기각
- **원본 TTF 그대로 번들**: 1.2MB 초과. standalone 이미지 크기 증가. 기각
- **Google Fonts runtime fetch**: 네트워크 의존성. 기각

**Consequences**:
- Python + fonttools 도커/CI 환경에서 subset 재생성 가능
- TTF 1.6MB 는 **서버 번들에만 포함** — 클라이언트 전송 0 (OG 이미지는 서버에서 PNG 로 렌더되어 전송됨)
- `scripts/build-og-fonts.py` README 와 실행 가이드 필요
- Dockerfile 에서 `COPY public` 필수 (standalone 은 `public/` 자동 복사 안 함)

---

## ADR-009. `ImageResponse` 런타임 — Node.js 명시

**Context**: `next/og` `ImageResponse` 는 기본 Edge runtime. 홈서버 standalone 에서는 Node.js 우선.

**Decision**: 각 `opengraph-image.tsx` 및 OG 이미지를 생성하는 API Route(`route.tsx`) 모두에 `export const runtime = "nodejs"` 명시.

**Drivers**:
- **홈서버 standalone 안정성**: Node.js 전용 API(`fs.readFile` 로 폰트/로고 로드)를 문제없이 사용
- **의존성 제약 최소**: Edge runtime 이 제한하는 Node API 사용 가능 (future-proof)
- 성능 차이는 ISR 캐싱(60초) 이 흡수

**Alternatives Considered**:
- Edge runtime: 빠르지만 `fs` 미지원 → 폰트/로고 embedding 복잡. 기각

**Consequences**:
- 첫 요청은 Node runtime 부팅 비용. 이후는 ISR 캐시 히트로 무의미
- `fs.readFile(path.join(process.cwd(), 'public/fonts/...'))` 같은 Node API 사용 허용

---

## ADR-010. Markdown 본문 선두 H1 제거 (`stripLeadingH1`)

**Context**: 글 상세 페이지(`src/app/posts/[...slug]/page.tsx:177`) 가 `<h1>{title}</h1>` 을 먼저 렌더한 뒤, `MarkdownRenderer` 로 본문을 그대로 렌더한다. 많은 글이 본문 맨 위에 `# Title` 로 시작하므로 **H1 이 한 페이지에 2개** 가 된다. `extractTitle()` 은 title 을 추출하기만 하고 원본 content 에서 제거하지 않는다. FolderPage 의 README 렌더에도 동일 패턴이 존재할 수 있다.

**Decision**: `src/lib/markdown.ts` 에 `stripLeadingH1(content)` 유틸을 추가해, **본문 최상단에 등장하는 첫 h1 라인과 이어지는 공백 라인을 제거**한다. 글 상세와 FolderPage README 렌더 직전에 전처리로 적용.

**Rule set**:
- frontmatter 제거 후 남은 본문에서, 선두의 `^#\s+.+$` 라인 **1개** + 뒤이은 빈 라인들을 제거
- 첫 비공백 라인이 h1 이 아니면 변경 없음
- 본문 중간에 등장하는 h1 은 유지 (기존 글 내 섹션 마커로 간주)

**Drivers**:
- Google SEO 권고: 페이지당 **단일 H1** 이 가장 명확한 주제 신호
- Markdown 원본 (GitHub `jon890/fos-study`) 의 `# Title` 관행을 보존하면서, 프론트엔드 렌더 단계에서만 중복 제거 — 원본 불변

**Alternatives Considered**:
- **`MarkdownRenderer` components.h1 → h2 강등** (기각): 본문 중간 h1 까지 강등되어 의도 왜곡
- **Markdown 원본 수정** (기각): 200+ 글 일괄 수정 부담 + GitHub sync 마다 재수정 필요
- **remark plugin** (기각): 오버엔지니어링. 한 줄 regex 로 해결 가능

**Consequences**:
- 글 상세 / FolderPage README 에서 h1 중복 해소
- MarkdownRenderer 자체는 순수 렌더러로 유지 (전처리는 caller 책임)
- 단위 테스트로 케이스 (frontmatter 있음/없음, h1 있음/없음/중간, 빈 content) 검증 — regression 방지

**Follow-ups**:
- 향후 다른 페이지(검색 결과 등)에서 Markdown 렌더 시에도 동일 전처리 적용 여부 판단
- 글 본문의 heading 계층이 h2 부터 시작하게 되므로, rehype-slug + TOC 생성 로직 (`generateTableOfContents`) 영향 재확인
  → **확인됨**: `generateTableOfContents(mainContent)` 에 stripped content 를 전달하므로 H1 제목이 TOC 에서 제거되는 것이 의도된 동작. 페이지 `<h1>` 으로 이미 노출되므로 TOC 중복 없음

---

## ADR-011. 메인 도메인 전환 — `blog.fosworld.co.kr` 단일화

**Context**: 현재 `fosworld.co.kr` + `blog.fosworld.co.kr` 두 도메인이 같은 앱을 서빙 중. GSC 리포트에서 `blog.*` URL 10개가 "적절한 표준 태그가 포함된 대체 페이지" 로 분류 (canonical 이 `fosworld.co.kr` 을 가리키기 때문). 크롤 예산 분산 + 운영 부담 + 브랜드 혼란. 당초 두 도메인을 모두 쓰던 이유는 "AdSense 서브도메인 미지원" 이라는 오해였으나 실제로 AdSense 는 서브도메인 완전 지원.

**Decision**: **`blog.fosworld.co.kr` 을 메인 도메인으로 단일화**. `fosworld.co.kr` 은 **`/ads.txt` 만 예외 서빙**하고 나머지 경로는 `blog.fosworld.co.kr` 로 301 리디렉션.

**Implementation**:
- 앱 코드: `.env` 의 `NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr` 로 교체 → 모든 canonical/sitemap/OG/JSON-LD 자동 재생성 (코드 전체에 하드코딩된 도메인 참조 없음 — `env.*` 경유)
- 홈서버 nginx: `server_name fosworld.co.kr` 블록에서 `location = /ads.txt` 는 실제 파일 서빙, 나머지는 `return 301 https://blog.fosworld.co.kr$request_uri`
- SSL: Let's Encrypt 인증서가 `blog.*` 에도 발급되어 있어야 함 (현재 접근 가능 상태로 보아 OK)
- GSC: Domain property (DNS TXT 인증) 기반이므로 서브도메인 자동 커버. 새 sitemap URL (`https://blog.fosworld.co.kr/sitemap.xml`) 수동 제출 권장

**Drivers**:
- **SEO 일관성**: canonical 분산 해소 → Google 이 단일 URL 만 크롤/색인
- **AdSense 정책 호환**: `fosworld.co.kr/ads.txt` 를 예외로 유지하여 루트 도메인 레벨 ads.txt 정책 충족
- **브랜드 명확**: `blog.*` = 블로그 라는 의미가 URL 에 담김. 루트는 향후 landing/포트폴리오로 확장 여지

**Alternatives Considered**:
- **`fosworld.co.kr` 메인 유지 + `blog.*` 301 리디렉션**: 기술적으로 동등하지만 "`blog.*` 을 주 브랜드로" 선호
- **두 도메인 병행 유지** (현재 상태): Google 은 "정상" 이라 평가하지만 크롤 예산/운영 부담 지속
- **`blog.*` 에 별도 앱**: 과도한 복잡도. 기각

**Consequences**:
- 도메인 전환 후 2~4주 간 SEO 순위 일시 변동 가능 (301 리디렉션이 링크 주스를 `blog.*` 로 이전)
- 기존 `fosworld.co.kr/*` 외부 링크는 301 로 자동 연결 (방문자 UX 영향 없음)
- 배포 절차에 nginx 설정 변경 단계 추가 — `docs/deployment.md` 로 가이드화

**Follow-ups**:
- AdSense 는 승인 신청 전에 전환 완료 후 `blog.fosworld.co.kr` 로 신청 (URL 일관성)
- 향후 `fosworld.co.kr` 루트에 landing 페이지가 필요해지면 nginx 예외 추가 (현재는 `/ads.txt` 만)

---

## ADR-012. AdSense 승인 요건 — 정책/소개 페이지 + GitHub 프로필 연동

**Context**: Google AdSense 승인 신청을 위해 **개인정보처리방침(Privacy Policy)** 은 필수. About/Contact 페이지는 "사이트 소유자 식별 + 방문자 소통 경로" 를 위해 권장. Terms of Service 는 AdSense 필수 아님.

**Decision**:
- **필수 페이지 3개 추가**: `/privacy`, `/about`, `/contact`
- **Terms of Service 제외** (선택 사항, 블로그 규모에 오버엔지니어링)
- **About 페이지는 GitHub 프로필 런타임 fetch + ISR 1시간** 로 구현 (`jon890` 계정)
- **Contact**: 이메일 `jon89071@gmail.com` + GitHub Issues (`jon890/fos-study/issues`) 링크 병기
- **Privacy Policy 톤**: 평이한 한국어 (법률 용어 스타일 X)
- **정책 페이지 푸터 노출** + sitemap 반영 (indexable)

**Data Collection 공개 범위** (Privacy Policy 내용):
- **방문 통계**: IP 를 SHA-256 해시로만 저장 (`visit_logs.ip_hash`) → 복원 불가, 중복 방문 판별 목적
- **댓글**: 닉네임(공개) + 비밀번호(bcrypt 해시) + 내용. IP 미수집
- **쿠키/로컬스토리지**: 테마 설정(localStorage), 향후 Google AdSense 광고 쿠키 (Google 소유, 정책에 따라 비활성화 가능 안내)
- **Google Analytics**: 현재 **미사용** (추후 도입 시 개정)

**GitHub 프로필 연동 (About 페이지)**:
- 런타임 fetch: `fetch('https://api.github.com/users/jon890', { next: { revalidate: 3600 } })`
- 사용 필드: `name, avatar_url, bio, html_url, public_repos, followers`
- Rate limit: GitHub 비인증 60 req/hour — ISR 1시간 캐시로 충분
- 실패 시 fallback: 아바타 없이 텍스트만 렌더 + BLG2 4-field 로그
- `next.config.ts` `images.remotePatterns` 에 `avatars.githubusercontent.com` 추가

**Drivers**:
- **AdSense 정책 필수 요건 충족** — 승인 반려의 최빈 사유는 Privacy Policy 부재
- **ads.txt 기구현 활용**: `src/app/ads.txt/route.ts` 동적 route 가 이미 존재 → 승인 후 env 에 publisher ID 입력만 하면 즉시 작동
- **About 페이지 최신성**: GitHub 프로필 정보 변경 시 별도 커밋 없이 자동 반영

**Alternatives Considered**:
- **Terms of Service 포함**: 블로그 규모에 과함. 필요 시 별도 plan 으로 추가
- **About 페이지 하드코딩**: 프로필 변경 시 재빌드 필요. 기각
- **About 페이지 build-time GitHub fetch**: 빌드 실패 시 페이지 깨짐. 런타임 ISR 이 복구 쉬움

**Consequences**:
- 푸터에 "정책" 섹션 추가 → 기존 푸터 레이아웃 조정
- sitemap 에 3개 URL 추가 (`/privacy`, `/about`, `/contact`)
- GitHub API 장애 시 About 페이지 일부 degrade (아바타 누락) 허용
- `docs/adsense-checklist.md` 신규 — AdSense 신청 절차 + 승인 후 env 업데이트 체크리스트

**Follow-ups**:
- 승인 후 `NEXT_PUBLIC_GOOGLE_ADSENSE_ID` 에 실제 pub ID 입력 → 재배포
- 광고 배치 (광고 단위 ID 별 page/sidebar/inline) 전략은 별도 plan 에서 진행
- GA4 도입 시 Privacy Policy 개정 (Drivers 섹션 업데이트)

---

## ADR-011. catch-all 세그먼트의 OG 이미지 — API Route 우회

**Context**: Next.js App Router 의 `opengraph-image.tsx` (metadata file convention) 는 폴더 경로 뒤에 `/opengraph-image` URL 세그먼트를 자동 생성한다. `src/app/posts/[...slug]/`, `src/app/category/[...path]/` 같은 **catch-all 세그먼트(`[...x]`) 내부에 이 파일을 두면 빌드 실패**:

```
Error: Catch-all must be the last part of the URL in route "/posts/[...slug]/opengraph-image".
```

catch-all 은 URL 의 마지막 부분이어야 한다는 라우터 규칙이, metadata file 이 만드는 추가 세그먼트와 충돌한다. 단일 dynamic segment(`[slug]`) 에서는 이 제약이 없다.

**Decision**: catch-all 세그먼트의 동적 OG 이미지는 **API Route** 로 구현하고, 해당 페이지의 `generateMetadata` 에서 `openGraph.images` 에 API Route URL 을 직접 주입.

- catch-all 있는 경로:
  - `src/app/api/og/posts/[...slug]/route.tsx` — `ImageResponse` 반환
  - `src/app/api/og/category/[...path]/route.tsx` — 동일
- catch-all 없는 경로는 기존 metadata file convention 유지:
  - `src/app/opengraph-image.tsx` (홈)
  - `src/app/categories/opengraph-image.tsx`

**Drivers**:
- **Next.js 라우터 구조적 제약** — 단일 dynamic 과 catch-all 은 동작이 다름. metadata file 우회 불가
- **검색엔진 호환성 동일** — 크롤러는 `<meta property="og:image" content="...">` URL 을 따라가므로 metadata file 이든 API Route 든 결과 동일
- **단일 컨벤션 강제 회피** — 가능한 곳은 metadata file (자동 ISR), 불가능한 곳만 API Route (수동 `Cache-Control`). 각 구조의 장점 활용

**Alternatives Considered**:
- **모든 경로를 API Route 로 통일**: 일관성은 있으나 metadata file 의 자동 ISR 포기. 기각
- **catch-all 을 단일 dynamic + optional segment 로 리팩토링**: 기존 URL 구조 대규모 변경. 범위 초과. 기각
- **catch-all 경로 OG 를 정적 fallback 만 사용**: 글별 OG 이미지 불가능 → plan002 목표(CTR 상승) 훼손. 기각

**Consequences**:
- API Route 에 `export const revalidate = 60` 을 두면 Next.js 가 자동으로 `Cache-Control: public, max-age=0, must-revalidate, s-maxage=60, stale-while-revalidate=...` 를 부여 → metadata file 과 동등한 ISR 동작. 별도 `Cache-Control` 수동 반환 불필요
- `generateMetadata` 내부에서 OG URL 생성 시 `absolute URL` 권장 (`metadataBase` 설정 시 relative 도 가능)
- 향후 catch-all 경로가 추가되면 동일 패턴(`/api/og/{scope}/[...x]/route.tsx`) 적용
- 같은 이미지 스타일/유틸(`src/lib/og.ts`) 을 metadata file 과 API Route 가 공유 — 렌더 로직 중복 방지
