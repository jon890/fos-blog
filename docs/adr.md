# ADR — 기술 결정 기록

이 문서는 **코드/설정/git log로 자명하지 않은 기술 결정**만 기록한다. 자명한 사항(파일 위치, 함수명, 단순 구현 선택)은 제외. AI 에이전트가 설계 철학을 빠르게 추론하기 위한 컨텍스트.

> 신규 ADR 추가/수정 시 아래 인덱스도 함께 갱신 — 분류 + 1줄 요약 + 앵커 링크.

---

## ADR Index

### 콘텐츠 & UX

- [ADR-001](#adr-001) — 무한 스크롤 페이지 (SSR 첫 페이지 + 클라이언트 fetch 하이브리드)
- [ADR-003](#adr-003) — 홈 진입 UX (섹션 하단 CTA 버튼, 카테고리 링크와 차별화)
- [ADR-005](#adr-005) — 리스트 페이지 `noindex` (`/posts/latest|popular`)
- [ADR-006](#adr-006) — IntersectionObserver 직접 구현 (의존성 0)
- [ADR-010](#adr-010) — Markdown 본문 선두 H1 제거 (`stripLeadingH1`)

### 데이터 & API

- [ADR-002](#adr-002) — 페이지네이션 (최신=cursor, 인기=offset+pagePath)
- [ADR-004](#adr-004) — 무한 스크롤 데이터 fetch = API Route

### OG 이미지 & 공유

- [ADR-007](#adr-007) — `next/og` 동적 + 정적 fallback 하이브리드
- [ADR-008](#adr-008) — Pretendard subset WOFF 로컬 번들 (UI/OG 통일)
- [ADR-009](#adr-009) — `ImageResponse` 런타임 = Node.js
- [ADR-011](#adr-011) — catch-all OG 이미지 = API Route 우회

### 도메인 & SEO 검색 노출

- [ADR-013](#adr-013) — 메인 도메인 단일화 (`blog.fosworld.co.kr`, `/ads.txt` 만 예외)
- [ADR-014](#adr-014) — AdSense 승인 요건 (privacy/about/contact + GitHub 프로필 fetch)

### 보안 & 안정성

- [ADR-015](#adr-015) — Visit tracking 경로 유효성 + middleware 분리
- [ADR-016](#adr-016) — Rate limit middleware (1000/min/IP, RFC1918 우회, Googlebot|Bingbot|NaverBot|Yeti 예외)
- [ADR-018](#adr-018) — DB 마이그레이션 자동화 (컨테이너 부팅 시 drizzle migrator 실행)

### 디자인 시스템

- [ADR-017](#adr-017) — Vercel 베이스 + Stripe 액센트 + Geist/Pretendard + shadcn 최신 (Claude Design 워크플로우)

### 마크다운 / 콘텐츠 렌더

- [ADR-019](#adr-019) — 코드 블록 하이라이팅 (rehype-pretty-code + shiki dual theme)
- [ADR-020](#adr-020) — 마크다운 변환 react-markdown → unified async (server component, plan014)
- [ADR-021](#adr-021) — 댓글 디자인 라이브러리 + 보안 정책 (rhf + zod + sonner / escapeHtml 단방향 / USER_FRIENDLY_ERRORS / og-palette 분리, plan022)

---

<a id="adr-001"></a>

## ADR-001. 무한 스크롤 페이지 — SSR 첫 페이지 + 클라이언트 fetch 하이브리드

**Context**: 홈에서 인기/최신 6개씩만 노출, 전체 200개 글 탐색 경로 부재.

**Decision**: 전용 페이지 `/posts/latest`, `/posts/popular` 신설. 첫 10개 SSR + 이후 클라이언트 `fetch` 무한 스크롤.

**Why**: SEO 보존 + 빠른 FCP + 끊김 없는 스크롤. 통합 페이지(상태 복잡)/풀 CSR(SEO 손해)/페이지네이션(체감 느림) 모두 기각. 페이지 자체는 noindex(ADR-005). 뒤로가기 시 state 초기화는 감수 — 필요 시 sessionStorage 복원 추후 검토.

---

<a id="adr-002"></a>

## ADR-002. 페이지네이션 — 최신=Cursor, 인기=Offset 혼합

**Context**: 무한 스크롤은 페이징 안정성이 핵심. 글 추가/변동 시 중복/누락 없어야 함.

**Decision**:

- **최신글**: Cursor `(updatedAt, id)` — `WHERE (updated_at, id) < (?, ?) ORDER BY updated_at DESC, id DESC`
- **인기글**: Offset + 2차 정렬 키 `pagePath` — `ORDER BY visit_count DESC, page_path ASC`

**Why**: 최신글은 sync 배치 중 동일 `updatedAt` 가능 → cursor 누락 방지 위해 `id` secondary 필수. 인기글은 `visitCount` 동점이 흔하지만 변동이 느려 offset+`pagePath` 정렬로 충분. 둘 다 offset(최신글 중복)/둘 다 cursor(인기글 SQL 복잡) 모두 기각. 인덱스 2개 추가 필요(`data-schema.md`).

---

<a id="adr-003"></a>

## ADR-003. 홈 진입 UX — 섹션 하단 CTA 버튼

**Context**: 카테고리 섹션은 헤더 우측 "모두 보기 →" 링크. 인기/최신 섹션도 같은 패턴 가능.

**Decision**: 인기/최신 섹션은 **섹션 하단 큰 CTA 버튼** 으로 차별화. 카테고리 링크 패턴과 의도적 차이.

**Why**: 글 목록은 핵심 탐색 행동 — 더 강한 클릭 유도 필요. 헤더 우측 링크는 모바일 터치 타깃(<44px) 위험. 두 패턴 공존 후 클릭률 비교로 추후 통일 검토.

---

<a id="adr-004"></a>

## ADR-004. 무한 스크롤 데이터 Fetching — API Route

**Context**: 무한 스크롤 추가 로드 API 수단 선택.

**Decision**: API Route (`/api/posts/latest`, `/api/posts/popular`).

**Why**: 표준 GET → 브라우저/CDN 캐시 + devtools 디버깅 용이. Server Action(POST 만 지원, 캐시 미활용)/Server Components+searchParams(전체 리렌더, URL 상태 미반영 결정과 충돌) 모두 기각. JSON 직렬화 경계는 `Date → ISO string` cursor 파싱 시 처리.

---

<a id="adr-005"></a>

## ADR-005. 리스트 페이지 `noindex`

**Context**: 리스트 페이지는 검색엔진 가치 낮고 중복 콘텐츠 가능성(글 제목 이미 홈/카테고리에 노출).

**Decision**: `/posts/latest`, `/posts/popular` 모두 `robots: { index: false, follow: true }`.

**Why**: 검색 결과 CTR 희석 방지 + 개별 글 페이지로 색인 집중. `follow: true` 유지 → 크롤러가 리스트 통해 글까지 도달.

---

<a id="adr-006"></a>

## ADR-006. IntersectionObserver 직접 구현 (의존성 미도입)

**Context**: 무한 스크롤 트리거 구현 방법.

**Decision**: 네이티브 `IntersectionObserver` 직접 사용. `react-intersection-observer` 등 래퍼 미도입.

**Why**: 번들 0 추가 + 10줄 패턴으로 충분 + MVP 의존성 최소 정책. `useEffect` + `useRef(observer)` 로 인스턴스 고정 + cleanup.

---

<a id="adr-007"></a>

## ADR-007. OG 이미지 — `next/og` 동적 + 정적 fallback 하이브리드

**Context**: `layout.openGraph.images` 미설정 → 공유 시 이미지 없음. `ArticleJsonLd.publisher.logo` 가 실존 안 하는 `/icon` URL → Rich Results 검증 실패.

**Decision**:

- **정적 fallback**: `public/og-default.png` (1200×630), `public/logo.png` (512×512) — `layout.tsx` 기본값 + `JsonLd` publisher.logo
- **동적 생성**: `next/og` `ImageResponse` — 페이지마다 제목/발췌/카테고리 배지 렌더
  - 단일 dynamic: `opengraph-image.tsx` (홈, categories)
  - catch-all: `/api/og/{scope}/[...x]/route.tsx` (ADR-011)
- **ISR**: `revalidate = 60` (양쪽 동등)

**Why**: 공유 시 제목 노출로 CTR 극대화 + standalone 호환 + fallback 보험. 정적 1장(글마다 동일, 변별력 없음)/SSG pre-render(빌드 시간 + 글 수정 반영 지연) 기각. 공용 유틸 `src/lib/og.ts` 로 스타일/폰트/로고 embedding 중앙 관리.

---

<a id="adr-008"></a>

## ADR-008. 동적 OG 폰트 — Pretendard subset WOFF 로컬 번들 (UI/OG 통일)

**Context**: `ImageResponse` (satori) 한글 렌더에 폰트 필수. CDN fetch 는 홈서버 네트워크 의존. plan021 에서 OG 디자인을 plan009 기반으로 갱신하면서 UI 폰트(ADR-017 — Pretendard) 와 통일 결정.

**Decision**: Pretendard Bold subset 을 `public/fonts/Pretendard-Bold-subset.woff` 로 번들 (~350KB, npm `pretendard@1.3.9` 의 `dist/web/static/woff-subset/Pretendard-Bold.subset.woff`). `src/lib/og.ts` `loadOgFont()` 가 `process.cwd()` 기반으로 로드, `ImageResponse.fonts: [{ name: "Pretendard", data, weight: 700, style: "normal" }]` 전달. 4개 라우트 (`api/og/posts/[...slug]`, `api/og/category/[...path]`, `app/opengraph-image`, `app/categories/opengraph-image`) 모두 동일.

**Why**:
- **Pretendard 채택**: UI 폰트(ADR-017)와 통일 → OG 이미지의 한글 톤이 사이트 본문과 일치. plan009 디자인 시스템의 핵심 폰트.
- **WOFF 채택 (plan021 검증)**: Pretendard TTF 가 npm 패키지 + jsdelivr CDN 모두 미존재 (woff/woff2 만 배포). satori 는 TTF/OTF/**WOFF** 지원, **WOFF2 만 미지원** — WOFF 는 직접 검증 시 정상 렌더. 이전 ADR 의 "woff 호환 불확실" 가정 폐기.
- **subset 350KB**: Noto KR full 1.6MB 대비 서버 번들 부피 감소. Pretendard subset 은 KS X 1001 + 자주 쓰는 신조어 커버.
- **외부 의존 0**: 홈서버 네트워크 차단 환경에서도 OG 동작 보장. Dockerfile `COPY public` 으로 함께 번들.
- 기각: Google Fonts fetch (네트워크 의존), Noto Sans KR (UI 와 분리되어 톤 불일치), woff2 (satori 미지원).

**Scope 명시**: OG 이미지 생성 전용 (서버 사이드 satori). UI 렌더링 폰트는 [ADR-017](#adr-017) 참조. 이번 ADR 갱신으로 두 ADR 의 폰트 패밀리가 일치.

---

<a id="adr-009"></a>

## ADR-009. `ImageResponse` 런타임 — Node.js 명시

**Context**: `next/og` 기본 Edge runtime. 홈서버 standalone 우선.

**Decision**: 모든 `opengraph-image.tsx` 와 OG `route.tsx` 에 `export const runtime = "nodejs"`.

**Why**: 홈서버 standalone 안정성 + `fs.readFile` 등 Node API 자유 사용 + ISR 60초가 부팅 비용 흡수. Edge runtime 은 `fs` 미지원 → 폰트/로고 embedding 복잡, 기각.

---

<a id="adr-010"></a>

## ADR-010. Markdown 본문 선두 H1 제거 (`stripLeadingH1`)

**Context**: 글 상세에서 페이지 `<h1>{title}</h1>` + Markdown 본문 첫 `# Title` 둘 다 렌더 → **H1 2개**. `extractTitle` 은 추출만 하고 원본 미수정. FolderPage README 도 동일.

**Decision**: `src/lib/markdown.ts` 에 `stripLeadingH1(content)` 추가 — 선두 `^#\s+.+$` 1개 + 뒤이은 빈 라인 제거. 본문 중간 h1 은 유지 (섹션 마커). 글 상세 + FolderPage README 렌더 직전 적용.

**Why**: Google SEO 권고(페이지당 단일 H1) + Markdown 원본(`jon890/fos-study`) 의 `# Title` 관행 보존 — 렌더 단계만 정리. h1→h2 강등(중간 h1 도 강등)/원본 수정(200+ 글 + sync 마다 재수정)/remark plugin(과함) 기각. TOC 는 stripped content 로 생성 → H1 중복 없음.

---

<a id="adr-011"></a>

## ADR-011. catch-all OG 이미지 — API Route 우회

**Context**: Next.js metadata file `opengraph-image.tsx` 는 폴더 뒤에 `/opengraph-image` 세그먼트를 자동 부여. catch-all (`[...x]`) 내부에 두면 빌드 실패: `Catch-all must be the last part of the URL`.

**Decision**: catch-all 경로는 **API Route** 로 OG 이미지 생성, `generateMetadata` 가 `openGraph.images` 에 URL 직접 주입.

- catch-all: `src/app/api/og/posts/[...slug]/route.tsx`, `src/app/api/og/category/[...path]/route.tsx`
- 단일 dynamic: 기존 `opengraph-image.tsx` 컨벤션 유지 (홈, categories)

**Why**: Next.js 라우터 구조적 제약 — 우회 불가. 크롤러는 `<meta og:image>` URL 만 따라가므로 결과 동일. `revalidate = 60` 만 두면 자동 `Cache-Control` 부여 → metadata file 과 동등 ISR. 모든 경로 통일(자동 ISR 포기)/라우터 리팩토링(범위 초과)/정적 fallback 만(CTR 손해) 기각. 공용 `src/lib/og.ts` 로 metadata file/API Route 가 렌더 로직 공유.

---

<a id="adr-013"></a>

## ADR-013. 메인 도메인 단일화 — `blog.fosworld.co.kr`

**Context**: `fosworld.co.kr` + `blog.fosworld.co.kr` 가 같은 앱을 서빙 → GSC "대체 페이지" 10개 분류, 크롤 예산 분산. 두 도메인 병행 운영의 SEO 손해 해소가 주요 동기.

**Decision**: `blog.fosworld.co.kr` 메인 단일화. `fosworld.co.kr` 은 **`/ads.txt` 만 예외 서빙**, 나머지는 `blog.*` 로 301.

- `NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr` → canonical/sitemap/OG/JSON-LD 자동 재생성 (코드 하드코딩 0)
- 홈서버 NPM(`fos-npm` 컨테이너) Custom: `location = /ads.txt` proxy + `location /` `return 301`
- GSC Domain property (DNS TXT) 가 서브도메인 자동 커버. 새 sitemap 수동 제출

**Why**: canonical 분산 해소 + AdSense `ads.txt` 루트 정책 호환 + 브랜드 명확화. 반대 방향(`fosworld.co.kr` 메인) 은 기술적으로 동등하지만 `blog.*` 브랜드 의도. 두 도메인 병행(크롤 예산 낭비)/별도 앱(과도) 기각. 도메인 전환 후 2~4주 SEO 변동 감수 — 301 이 자동 연결.

**AdSense 정책 상호작용**: AdSense 신청 단위는 루트 도메인(`fosworld.co.kr`). 봇이 301 추적 후 `blog.*` 콘텐츠를 평가하는 시나리오로 **현재 301 그대로 신청 → 승인 시 AdSense 사이트 메뉴에서 `blog.*` 서브도메인 추가**. 거절될 경우 fallback: `6.conf` 의 `location /` 을 임시 `proxy_pass` 로 환원해 양도메인 동일 서빙 → 재신청 → 승인 후 다시 301 복구. (ADR-014)

---

<a id="adr-014"></a>

## ADR-014. AdSense 승인 — 정책/소개 페이지 + GitHub 프로필

**Context**: AdSense 승인 신청에 Privacy Policy 필수, About/Contact 권장.

**Decision**:

- **신규 페이지 3개**: `/privacy`, `/about`, `/contact` (indexable, 푸터 노출, sitemap 반영)
- Terms of Service 제외 (블로그 규모 오버엔지니어링)
- **About**: GitHub `jon890` 프로필 런타임 fetch + ISR 1시간. 실패 시 텍스트 fallback + BLG2 로그. `next.config.ts` 에 `avatars.githubusercontent.com` 추가
- **Contact**: 이메일 `jon89071@gmail.com` + GitHub Issues `jon890/fos-study/issues`
- **Privacy 톤**: 평이한 한국어. 수집 항목 명시 — IP SHA-256 해시(`visit_logs`), 댓글 닉네임/bcrypt 비밀번호(IP 미수집), 테마 localStorage, AdSense 쿠키. GA 미사용

**Why**: 승인 반려의 최빈 사유는 Privacy 부재. `src/app/ads.txt/route.ts` 동적 route 기구현 → 승인 후 env publisher ID 입력만으로 작동. About 하드코딩(프로필 변경 시 재빌드)/build-time fetch(빌드 실패 시 페이지 깨짐) 기각. GA4 도입 시 Privacy 개정 필요.

**도메인 신청 단위**: AdSense 는 루트 도메인(`fosworld.co.kr`) 으로만 신청 가능 — 서브도메인(`blog.*`) 단독 입력 불가. 등록 정책: 루트 승인 → 사이트 메뉴에서 서브도메인 추가 → 별도 심사 없이 광고 노출.

**신청 전략**: 현재 ADR-013 의 301 리디렉션을 **그대로 두고** `fosworld.co.kr` 신청. AdSense 봇이 redirect 추적 후 `blog.*` 콘텐츠를 평가할 가능성이 높음. 거절 시 `6.conf` 의 `location /` 을 임시 `proxy_pass` 환원(양도메인 동일 서빙) → 재신청 → 승인 후 301 복구. 절차/롤백은 `docs/adsense-checklist.md` §2 참조.

---

<a id="adr-015"></a>

## ADR-015. Visit tracking 경로 유효성 + middleware 분리

**Context**: SQL injection 시도 등 비유효 경로(`interview/...XOR(sleep(15))...`)가 `visit_stats` 에 누적되어 통계 과대 계상. 기존 `proxy.ts` 가 정규식 매칭 외 글 존재 검증 없이 모든 요청 기록.

**Decision**:

- **DB 존재 검증**: `posts.path` 가 실제 존재할 때만 기록 (비활성 글 `is_active=0` 도 보존)
- **Skip**: `/posts/latest`, `/posts/popular` 는 noindex 리스트 → DB 조회 없이 early return
- **길이 가드**: `pathname.length > 300` 차단
- **파일 분리**: `src/middleware/visit.ts` + `src/middleware/rateLimit.ts` (ADR-016) → `src/proxy.ts` 는 thin orchestrator
- **Cleanup**: `drizzle-kit generate --custom` 일회성 마이그레이션. 활성/비활성 무관 `posts.path` 매치 row 보존, 그 외(홈 `/` 제외) 삭제

**Why**: 통계 정합성 + 로그 오염 차단 + middleware 단일 책임. middleware 가 이미 Node Runtime(`crypto`/`getDb` 직접 사용) 이라 DB 조회 자유. `getPostId` 추가 쿼리는 `waitUntil` 내부 — 응답 지연 0. `console.error` → BLG2 4-field logger 교체. 정규식 화이트리스트만(존재 안 하는 글 통과) 기각.

---

<a id="adr-016"></a>

## ADR-016. Rate Limiting — Next.js middleware in-memory fixed window

**Context**: 외부 다량 요청으로 홈서버 자원 소진 사고. NPM `limit_req` 미설정 + 앱 레벨 보호 부재.

**Decision**:
- Fixed window 60초/IP, 분당 **1000 요청** (PR #76 hotfix 완화 + plan007-2 본질 fix)
- **우회 대상**:
  - localhost: `127.x.x.x`, `::1`, `::ffff:127.x.x.x`, `"localhost"`
  - RFC1918 사설 대역: `10.0.0.0/8`, `172.16-31.x.x`, `192.168.0.0/16` (+ IPv4-mapped IPv6 형태)
  - IPv6 ULA: `fc00::/7`
  - 정상 봇 UA: `Googlebot|Bingbot|NaverBot|Yeti` (Google + Microsoft + Naver SEO)
- proxy.ts matcher 는 HTML navigation 만 카운트 — `/_next/data` (RSC payload), `/api/*`, root 정적 파일(`*.png|css|js|...`), `sitemap.xml|robots.txt|ads.txt|manifest.json` 모두 제외
- **위치**: `src/middleware/rateLimit.ts` — 홈서버 1 인스턴스, in-memory `Map`. NJS16 proxy 는 Node 고정이라 별도 runtime 명시 불필요
- **메모리 가드**: `buckets.size >= 10_000` 시 만료 windowKey 엔트리 일괄 sweep

**Why**: 외부 의존 0 + 1 인스턴스 충분. Redis/Sliding window 기각(over-engineering). matcher 를 HTML 요청 한정으로 좁혀 한 페이지 navigation = 1 카운트로 축소. LAN 내 접속(운영자/가족) 자연 우회 의도. 한국 SEO 핵심 봇(Yeti) 인덱싱 보장 의도. 메모리 가드는 장기 IP 다양성 누적 OOM 방지 — sweep 기준이 windowKey 만료라 활성 IP 카운트는 보존.

---

<a id="adr-018"></a>

## ADR-018. DB 마이그레이션 자동화 — 컨테이너 부팅 시 drizzle migrator 실행

**Context**: 현재 `start.sh` 가 `docker compose up -d` 만 호출 → 매 배포마다 사용자가 수동으로 `pnpm db:migrate` 실행. plan006 의 `0004_cleanup_stale_visits` 같은 마이그레이션이 자동 적용 안 됨 → 운영 누락 위험.

**Decision**: production 이미지에 `scripts/migrate.js` 포함 + Dockerfile CMD 를 `node migrate.js && node server.js` 로 교체. 컨테이너 부팅 시 미적용 마이그레이션 자동 apply.

- 스크립트: `drizzle-orm/mysql2/migrator` 의 `migrate()` 사용 — drizzle-kit CLI 미포함 가능 (production deps 만으로 실행)
- 이미지에 `drizzle/` 디렉터리 + 빌드된 `migrate.js` 복사
- 적용 idempotent: drizzle journal (`__drizzle_migrations` 테이블) 이 이미 적용된 마이그레이션 skip
- 부팅 시간: 신규 마이그레이션 0개면 ~수백 ms 추가, 1개 이상이면 SQL 크기에 비례

**Why**:

- **운영 안정성**: 배포 자동화 = 인적 누락 차단
- **drizzle-kit 미포함**: drizzle-orm 의 migrator 만 production deps 로 충분 → 이미지 크기 영향 0
- **Idempotency 보장**: 매 부팅마다 실행해도 안전
- 별도 init container(`docker-compose depends_on`) 도 가능하지만 단일 컨테이너 인라인이 더 단순. 복잡도 낮은 1인 운영 환경에 적합

**Consequences**:

- `Dockerfile` production stage 에 `drizzle/` + `migrate.js` 복사 추가
- 컨테이너 시작 로그에 `✓ migrations applied` 가시성
- 마이그레이션 실패 시 컨테이너 부팅 실패 (fail-fast — 의도된 동작. 다음 컨테이너 기동 전 수동 개입 필요)
- `start.sh` 의 docker compose up 만으로 모든 처리 완결 — 별도 step 불필요

**Follow-ups**:

- 추후 마이그레이션 lock (분산 환경) 필요 시 drizzle 의 `migrationsTable` 옵션 + 외부 락 검토. 현재 1 인스턴스라 불필요
- 큰 마이그레이션은 수동 검토 후 commit (BLG1 db:push 금지 규칙은 그대로 유지)

---

<a id="adr-017"></a>

## ADR-017. 디자인 시스템 — Vercel 베이스 + Stripe 액센트 + Geist/Pretendard + shadcn 최신

**Context**: 현재 디자인이 generic Tailwind look (gray + blue + rounded-xl + shadow-md) 으로 시각적 정체성 부족. 컬러 토큰 정의는 있으나 실제 사용 안 됨, shadcn/ui 미도입으로 UI 모두 자체 구현, Hero/PostCard 등 13개 문제점 식별 (참조: `docs/design-inspiration.md`).

**Decision**:

- **톤**: **Vercel 베이스** (pure black/white + 시안/블루 액센트, 절제, 미세 grid + 1px border, 작은 radius) + **Stripe 그라디언트 mesh** (hero 영역만) + **Linear** 의 큰 hero 텍스트 일부 차용
- **폰트**: 영문 **Geist Sans/Mono** (`geist` npm 패키지) + 한글 **Pretendard** (CDN) — Geist 와 톤 매칭 + 한글 가독성
- **컴포넌트 base**: **shadcn/ui 최신** (Tailwind v4 호환) — Dialog/Button/Card/Tooltip 등 도입. SearchDialog, Comments 등 자체 구현 점진 교체
- **모션**: **motion-one** (~3KB, Framer Motion 경량 alt) — 미세 page transition + hover 디테일
- **다크 우선**: default `dark` 유지 (Vercel/Linear 컨벤션, 현 동작과 일치)
- **토큰 시스템**: Tailwind v4 `@theme` 블록 (`globals.css`) 으로 표준화 — 컬러/타이포/spacing/radii/shadows/motion primitives
- **카테고리 9종 (canonical)**: `ai / algorithm / db / devops / java / js / react / next / system` — oklch chroma 0.09, lightness 0.74 (dark) / 0.50 (light). 데이터의 raw 카테고리 키 (architecture/network/interview/kafka/internet 등) 는 헬퍼 (`src/lib/category-meta.ts`, plan010) 에서 9종 중 하나로 정규화 (미매핑 → `system`)
- **OG / Avatar 팔레트는 7색 부분집합** (plan021/022): `og-palette.ts` 의 `OG_CATEGORY_HEX` 는 9종 중 `next` / `system` 제외한 7개만 hex 매핑. 이유: hash % palette.length 라 색 다양성만 충분하면 되고 `system` 은 fallback (`OG_CATEGORY_DEFAULT_HEX` brand teal) 와 의미가 겹침. `next` 는 forward-compat 자리
- **워크플로우**: Claude Design (Anthropic Labs Research Preview) 으로 mockup 생성 → 이 저장소에서 코드 구현. 단계별 프롬프트는 `docs/design-inspiration.md`

**Why**:

- **개발자 정체성**: 모던 dev-tool 사이트 (Vercel/Linear/Stripe) 톤이 기술 블로그와 자연스럽게 매치 + 운영자 1인 개발자 브랜드와 일관
- **외부 의존성 최소**: shadcn (소스 복사 모델, lock-in 없음) + motion-one (3KB) + Geist npm + Pretendard CDN — 합산해도 번들 영향 작음
- **한글 가독성 보존**: Pretendard 가 한글 dev-blog 사실상 표준. Geist 와 미세 매칭 양호
- **Claude Design 활용**: mockup → 코드 분리로 시각 합의 후 구현 → iteration 비용 절감

**Implementation 순서**: plan009 (토큰 + 폰트 + shadcn foundation) → plan010 (Card/List 컴포넌트 리디자인) → plan011+ (글 상세 / 홈 Hero / 검색 / 모션 등 — `docs/design-inspiration.md` 참조). 각 plan PR 마다 Lighthouse 회귀 자동 검증 (`.github/workflows/lighthouse.yml`).

**plan013 추가 결정**:

- **HeroMesh 구현 방식**: SVG `<radialGradient>` 3 stops + CSS `@keyframes mesh-rotate-slow` (60s/90s/75s linear) 채택. **Canvas 미채택 사유**: 라이트 모드 투명도 제어 + GPU 합성 레이어 비용이 정적 SVG 대비 과도, Lighthouse JS 비용 증가, prefers-reduced-motion 처리 까다로움. SVG + CSS 는 JS 0, 자연스러운 reduced-motion 지원, 토큰 (`--mesh-stop-*`) 으로 다크/라이트 색 전환 자동.
- **SVG `<stop>` 색은 inline `style={{ stopColor: ... }}` 로**: SVG presentation attribute 의 `stopColor="var(--...)"` 는 var() 미해석 (CSS context 가 아님). inline style 로 전달해야 var() 정상 동작.
- **Header brand mark 변경**: `📚 FOS Study` 이모지 → `● fos-blog/study` (Geist Mono + 시안 dot + glow). 이모지는 dev-blog 톤과 매치 안 됨, mono + dot 패턴이 Vercel/Linear 톤과 일관. dot 은 `--color-brand-400` 토큰 사용으로 다크/라이트 자동 전환.
- **HomeHero `<dl>` 통계 4 슬롯**: posts/categories/series 는 실데이터, subscribers 만 placeholder ("—"). UI 그리드 균형 + 향후 채울 자리 명시 의도 — 비활성 슬롯이라 disabled style 명시. (plan033 에서 series stat 실데이터 연결 — `countSeries()`)

**plan013-2 추가 결정 (Footer)**:

- **SiteFooter 컴포넌트 분리**: 기존 `layout.tsx` 인라인 footer → `src/components/SiteFooter.tsx` server component 로 추출. 4-column (Brand / Site+Policy / Categories / Connect) + Eyebrow status row + mesh accent + bottom built-with stack 으로 복잡도 증가 → layout.tsx 가독성 + 재사용성 확보. sub-component (`ColHead`/`FooterList`/`SocialItem`) 는 같은 파일 안 private 유지 — 재사용 범위 footer 한정이라 types/ 분리 불필요.
- **미구현 기능 graceful fallback 패턴**: RSS feed (`/rss.xml`) / Newsletter 는 별도 issue 로 위임하되 Footer 의 자리 예약 의도로 visible 유지. 처리 방식: `disabled` prop → `<a>` 가 아닌 `<span aria-disabled="true" title="준비 중">` + `pointer-events-none opacity-40`. 클릭 차단하면서 UI 자리 보존 — "곧 나올 것" 신호. 구현 시점에 prop 만 제거.
- **POLICY column arrow=path 패턴**: 정책 링크 (`/about`, `/privacy`, `/contact`) 의 hover decoration 은 `↗` 대신 경로 문자열 자체 (`arrowMono: true` mono font). 외부 링크 (Connect col 의 GitHub/Source ↗) 와 시각 차별화 + 내부 경로 명시. mockup 디자인 의도, helper 통일 권장 금지.
- **BUILD_DATE 하드코딩 follow-up**: `const BUILD_DATE = "2026.04.27"` 빌드 타임 스탬프. `process.env.BUILD_DATE` 또는 `package.json.version` 기반 동적화는 별도 issue. Footer eyebrow row 의 `v0.1 · {BUILD_DATE} · seoul, kr` 표시용.
- **category-meta canonical self-map 보강**: SiteFooter 가 lowercase canonical key (`"ai"`, `"db"`, `"js"`) 직접 호출 → 기존 `RAW_TO_CANONICAL` 은 raw key (`"AI"`, `"database"`, `"javascript"`) 만 매핑이라 fallback `"system"` 으로 잘못 처리됨 (3 카테고리 hue 오류). `RAW_TO_CANONICAL` 에 self-map 4 항목 (`ai/db/js/system`) 추가. `algorithm/devops/java/react/next` 는 raw==canonical 동일이라 자동.


<a id="adr-019"></a>

## ADR-019. 코드 블록 하이라이팅 — rehype-highlight → rehype-pretty-code + shiki dual theme (plan012)

**Context**: `rehype-highlight + highlight.js` 는 CSS import 방식 (`highlight.js/styles/github-dark.css`) 으로 다크/라이트 테마 전환을 위해 별도 CSS 클래스 토글이 필요. 코드 블록 UI 프레임 (filename header / 언어 배지 / copy 버튼 / line numbers / line-highlight / diff·terminal variants) 을 추가하려면 모두 자체 wrapper 가 필요해 markup 이 무거워짐. plan011 (article page redesign) 의 `.prose :not(pre) > code` 인라인 코드 룰 + `.prose pre.mermaid` mermaid 격리 selector 와 호환되는 정합성 이슈도 있음.

**Decision**:

- **`rehype-pretty-code` (shiki 기반)** 채택. dual theme `{ light: "github-light", dark: "github-dark" }` 구성 → CSS variable (`--shiki-light` / `--shiki-dark`) 기반 토글 한 줄 (`html.dark .code-card-body pre span { color: var(--shiki-dark); }`) 로 다크/라이트 전환. **셀렉터 주의 (plan017)**: rehype-pretty-code v14 는 `.shiki` className 을 부여하지 않으므로 `.shiki` 셀렉터는 매칭 실패 → `.code-card-body pre span` 으로 토큰 span 직접 타깃. `unified-pipeline.test.ts` 가 이 계약 (className 부재 + `--shiki-light`/`--shiki-dark` 변수 보유) 을 회귀 테스트로 고정
- **`figure data-rehype-pretty-code-figure` 출력 구조 활용**: react-markdown `components.figure` 핸들러가 figure 를 받아 신규 `<CodeCard>` (client wrapper, copy 버튼) 로 교체. filename 은 자식 figcaption.textContent, language 는 자식 code.data-language 에서 추출 (헬퍼 `findChildText` / `findCodeProp` 을 `src/lib/markdown.ts` 에 신설)
- **mermaid 우회**: pretty-code Options 에 `filter` 가 없어 (fictional API), `data-language === "mermaid"` 검사로 우회. `components.figure` / `isMermaidPreNode()` 모두 `data-language` 기반 분기 + 기존 className 기반 검사 (legacy 호환) 동시 지원
- **`bypassInlineCode: true`**: plan011 의 `.prose :not(pre) > code` 인라인 룰 보존. inline code 는 shiki 처리 skip
- **`keepBackground: false`**: 코드 블록 배경은 우리 `.code-card-body` frame 토큰이 winner

**Why**:

- **dual theme 가벼움**: shiki CSS variable 방식이 라이트/다크 토글 한 줄로 가능 — light/dark 별 CSS 파일 import 토글 패턴 (highlight.js) 보다 가볍고 `html.dark` 컨벤션 (ADR-017) 과 자연스럽게 어울림
- **figure 구조 → 자연스러운 wrapper 주입**: pretty-code 가 이미 figure 로 wrap 한다는 사실을 활용해 react-markdown components.figure 한 핸들러로 모든 frame 도입 (filename / 언어 배지 / copy / line-highlight / diff·terminal variants 모두 동일 구조)
- **mermaid 우회 비용 0**: 사전 rehype 플러그인 추가 없이 단일 selector 변경 (`className` → `data-language`) 으로 plan011 mermaid 격리와 정합

**Implementation 순서**: plan012 phase-01 (의존성 교체 + CodeCard + frame 토큰 + 헬퍼 + 회귀 9 케이스). caching/CSP/getHighlighter allowlist 등 후속 최적화는 별도 plan.

> plan014 후속: shiki async highlighter 와 react-markdown sync 처리의 충돌 (`Error: 'runSync' finished async`) 발견 → 마크다운 변환을 react-markdown(sync) 에서 unified async 로 이전. ADR-020 참조.


<a id="adr-020"></a>

## ADR-020. 마크다운 변환을 react-markdown(sync) → unified async 로 전환 (plan014)

- **결정**: react-markdown 의존성 제거. `unified.process()` async + `hast-util-to-jsx-runtime` 으로 마크다운을 server component 에서 직접 처리. CodeCard / Mermaid 는 client island 그대로 유지.
- **맥락**: ADR-019 (rehype-pretty-code + shiki dual theme) 도입 후 production server log 에 `Error: 'runSync' finished async. Use 'run' instead` (digest `1174120868` / `2958684477`) 가 분 단위로 폭증. react-markdown 9.x 는 sync only (`processor.runSync()`) 인데 shiki async highlighter 가 첫 호출 시 lazy init → 충돌. SSR 첫 패스 (server) 에서 발생하며 `MarkdownRenderer` 가 `"use client"` 마킹돼도 RSC 환경 server 패스를 우회 못 함. `useState`/`useEffect` 등 client-only 기능은 사용 0건 — 잘못 마킹된 상태였음.
- **대안 기각**:
  - shiki sync mode (`createHighlighterCoreSync`) — dual theme + 다중 언어 시 lazy load 회피 어려움. 사용자 선택지 좁아짐
  - theme dual → single — 라이트/다크 토글 색 깨짐, 디자인 시스템 (ADR-017/019) 후퇴
  - react-markdown 의 async 모드 — 라이브러리 미지원 (sync 전용 설계)
- **트레이드오프**: react-markdown 의 `components` prop 사용 코드를 `hast-util-to-jsx-runtime` 형태로 일괄 이전 필요. 번들은 순수 감소 (react-markdown 제거, unified / remark-parse / remark-rehype / hast-util-to-jsx-runtime 은 transitive 였음 → direct dep promote 만).


<a id="adr-021"></a>

## ADR-021. 댓글 디자인 라이브러리 + 보안 정책 (plan022)

**Context**: 댓글 영역 354줄 자체 구현 (`Comments.tsx`) 을 plan022 에서 shadcn + react-hook-form + zod + sonner 로 전면 리디자인. UI 라이브러리 선택과 함께 client 번들 격리 / XSS 가드 / 사용자 노출 메시지 정책 동시 결정.

**Decision**:

1. **Form**: `react-hook-form` + `@hookform/resolvers` + `zod`. shadcn `Form` (Controller wrapper) 사용. 모드 별 schema 분리 (`createSchema` / `editSchema = createSchema.pick({password, content})`) + props discriminated union.
2. **Toast**: `sonner` 2.x (~6KB). `<Toaster />` 는 `<ThemeProvider>` 바깥에 mount (shadcn 권장).
3. **Avatar 팔레트**: `og-palette.ts` 신규 — `OG_CATEGORY_HEX` (7색) + `getCategoryHex` 의 단일 소스. `og.ts` 는 re-export 만. **이유**: `og.ts` 가 `node:fs` import 하므로 client component (Avatar.tsx) 에서 직접 import 시 Turbopack 이 fs 를 클라이언트 번들에 포함하려다 실패. palette 데이터를 pure module 로 떼면서 단일 소스 유지.
4. **Comment 타입**: `src/components/comments/types.ts` 신규 (`CommentData`). client component 가 `@/infra/db/schema/comments` (Drizzle) 직접 import 시 같은 번들 오염 발생 → 분리.
5. **XSS 가드 (단방향 저장 시점 escape)**: `src/lib/escape-html.ts` 의 `escapeHtml` (5문자: `& < > " '`) 을 `CommentRepository.createComment` / `updateComment` 의 `content` 인자에 적용. **read 시 unescape 없음** — React JSX text node 가 자동 escape 하므로 이중 escape 회피 (1회만 적용). `dangerouslySetInnerHTML` 사용 금지.
6. **에러 메시지 정책 (`USER_FRIENDLY_ERRORS` 화이트리스트)**: API 에러 응답에 `code` 필드 (`PASSWORD_MISMATCH` / `NOT_FOUND` 등) 포함, 클라이언트는 `USER_FRIENDLY_ERRORS[code] ?? "요청을 처리할 수 없습니다"` 로 매핑하여 toast. **`error.message` / `data.message` 직접 toast 금지** — SQL 구문 / 스택 / 내부 식별자 누출 위험.

**Why**:

- **react-hook-form 채택**: uncontrolled form → 리렌더 최소화 + zod 통합. 자체 useState 폼 대비 valida tion 로직 통일 + 타입 안전. shadcn `Form` 가 thin wrapper 라 lock-in 없음
- **sonner 채택**: 자체 toast 구현 회피 (~6KB), shadcn 공식 권장. dark/light 자동 (theme="system")
- **단일 소스 og-palette**: plan021 의 `OG_CATEGORY_HEX` 와 댓글 Avatar 팔레트가 같은 색이어야 — 색 변경 시 한 파일만 수정. 단 server-only deps 격리 위해 pure module 로 분리
- **단방향 escape**: React 가 이미 한 번 escape 하므로 read 시점 unescape = 이중 escape → `&amp;lt;` 같은 잘못된 표시. 저장 시 1회만 적용이 정답. dompurify 같은 풀 라이브러리 회피 — 댓글은 markdown 미지원 plain text 라 5문자 escape 면 충분
- **USER_FRIENDLY_ERRORS 화이트리스트**: 서버 raw error 노출은 SQL injection probe / 정보 노출 공격면 확장. code 필드 명시적 매핑이 모든 메시지의 단일 진입점

**Scope 명시**: 이 ADR 의 정책은 댓글 영역 한정. 다른 client form (검색 dialog, 향후 로그인) 도입 시 이 결정을 ADR-021 의 패턴으로 따른다 (rhf + zod + sonner + USER_FRIENDLY_ERRORS).

## ADR-022. About 페이지 — co-located CSS + 2-stage avatar (plan023)

**Context**: plan023 에서 `/about` 을 Claude Design mockup 시각 사양으로 전면 리디자인. 기존 Tailwind utility-first 컨벤션과 다른 CSS 전략 + GitHub avatar 표시 방식 두 결정이 비자명.

**Decision**:

1. **co-located CSS (`src/app/about/about.css`)**: `import "./about.css"` 로 page.tsx 에 주입. `.ab-*` BEM-ish prefix 클래스 사용. Tailwind utility 가 아닌 CSS 파일로 분리.
2. **2-stage avatar**: `.ab-avatar` 컨테이너에 항상 이니셜 (`<span className="ab-avatar-initial">`) 렌더 → GitHub `avatarUrl` 있으면 그 위에 `<Image className="ab-avatar-img" position:absolute inset:0>` 로 덮음. fetch 실패 / 부재 시 이니셜이 그대로 보임.

**Why**:

- **co-located CSS**: mockup 의 `::before`/`::after` 로 그리는 hairline 액센트, `@keyframes ab-pulse` (LAST SYNC 카드 발광), `oklch(0.74 0.09 ${hue})` 동적 chip dot 색은 Tailwind arbitrary value 만으로 표현이 어색하거나 불가능. about 한 페이지 한정이라 globals.css 오염 회피 + 모듈 단위 격리 효과. 향후 다른 페이지가 비슷한 패턴이면 ADR 갱신 후 일반 utility 화 검토.
- **2-stage avatar**: GitHub API 일시 장애 / rate limit 시 페이지 그래픽 깨짐 방지. fallback 분기를 ProfileCard 안에 if/else 로 두는 대신 디자인 자체가 두 표시 상태를 항상 처리하도록 설계 — default (이니셜) → enhanced (사진 덮음). mockup 의 gradient + initial 컨테이너는 fallback 이 아니라 base layer 라는 의도.

**Scope 명시**: 이 ADR 의 결정은 about 페이지 한정. 다른 페이지가 동일 패턴 도입 시 본 ADR 의 근거 (`::after` hairline / `@keyframes` / 동적 oklch / API 폴백) 가 모두 해당하는지 재검토.

## ADR-023. 태그 시스템 — `posts.tags JSON` + `JSON_CONTAINS` (plan026)

**Context**: issue #72 — 글 frontmatter 의 `tags` 를 DB 에 저장하고 tag 별 글 목록 페이지를 제공. 모델링 선택지가 둘이라 결정 의도 보존이 필요.

**Decision**:

1. **`posts.tags JSON NOT NULL DEFAULT ('[]')`** — 별도 `tags` / `post_tags` 정규화 테이블 대신 `posts` 의 JSON 컬럼. `folders` 와 같은 패턴 (이미 존재).
2. **조회**: `JSON_CONTAINS(tags, JSON_QUOTE(?))` — `?` 바인딩으로 SQL injection 안전. 인덱스 미사용 (full table scan).
3. **`/tag/[name]`** — 5분 ISR, `limit=50`, 존재하지 않는 tag 는 `notFound()`. `/tags` 인덱스 (전체 tag cloud) 는 OOS.
4. **정규화**: `trim().toLowerCase()` + 빈 문자열 제거 + `Set` dedup. 한글-영문 동의어 매핑 / 대소문자 별 분리는 OOS.

**Why (대안 기각)**:

- **정규화 테이블 (`tags` + `post_tags` join)** 기각: 218 글 × 평균 3-6 tag 규모에서 join 비용 vs JSON_CONTAINS full-scan 비용 차이 무시 가능. 별도 테이블 도입 시 schema 복잡도 + 마이그레이션 비용 큼. 향후 글 수가 1000+ 로 늘고 tag 검색이 성능 병목이 되면 별도 plan 으로 정규화 검토.
- **`limit=50`**: 한 tag 가 50 글 넘는 경우는 사실상 카테고리 수준 — pagination 보다 카테고리 분리가 자연스러움. pagination 미구현은 의도된 OOS.
- **`/tags` 인덱스 OOS**: 인덱스 페이지는 navigation 가치가 낮고 SEO 도 카테고리로 충분. 필요 시 별도 plan.
- **한글-영문 동의어 매핑 OOS**: 글 작성자 (jon890) 가 frontmatter 작성 시 일관성 유지하는 게 더 단순. 매핑 테이블 도입은 복잡도 대비 이익 작음.

**Scope**: 본 ADR 결정은 plan026 한정. 글 수 1000+ / tag 100+ 도달 시 정규화 테이블 + 인덱스 재검토.

## ADR-024. RSS feed — RSS 2.0 + `pubDate=createdAt` + 50 limit (plan027)

**Context**: issue #88 — `/rss.xml` 라우트 신설. RSS reader 가 글 발행을 추적할 수 있게. 형식 / 정렬 / 한도 세 결정이 코드/git log 로 자명하지 않음.

**Decision**:

1. **RSS 2.0** (Atom 1.0 기각) — channel/item 구조 + `<atom:link rel="self">` 만 추가해 reader 호환성 최대화.
2. **`<pubDate>` = `createdAt` (`updatedAt` 아님)** — sync 가 동일 글을 재처리하면 `updatedAt` 이 갱신됨. `pubDate` 가 그걸 따라가면 RSS reader 가 기존 글을 "새 글" 로 오인해 unread 표시 → 사용자 노이즈. `createdAt` 은 첫 sync 시점 고정이라 안전.
3. **`limit = 50`** — RSS reader 의 일반적 캐시 윈도우 (수 일~수 주 누락) 대비 충분. 글 발행 주기 평균 1일 1건 가정 시 50일 보장. 100+ 로 늘리면 채널 XML 크기 증가 + reader fetch 비용 증가. 향후 발행 빈도 변화 시 재검토.

**Why (대안 기각)**:

- **Atom 1.0** 기각: feature 차이는 거의 없고 RSS 2.0 reader 호환성이 더 넓음. atom:link self 만 채택해 양쪽 spec 의 강점 흡수.
- **`<content:encoded>` full HTML 본문 포함** 기각: feed 크기 증가 + 광고 없는 본문 노출이 트래픽 손실 우려. `<description>` 에 300자 summary (extractDescription) 만 노출.
- **`pubDate=updatedAt`** 기각: 위 #2 사유.
- **카테고리별 RSS (`/category/[name]/rss.xml`)** 기각: scope 큼 + 일반 RSS 가 카테고리 다양성 보존. 별도 plan 후보.

**Scope**: 본 ADR 결정은 plan027 한정. 글 수가 1년 100+ 도달 시 limit / pagination 재검토.

---

## ADR-025. 시리즈 시스템 — `posts.series VARCHAR + series_order INT` + 양쪽 필수 정책 (plan033)

**Context**: issue #127 — 다회 포스트 시리즈를 묶어 prev/next 네비게이션 + 시리즈 인덱스 페이지 제공. 데이터 모델, 누락 처리, URL 패턴, 인덱스 전략 4 결정이 코드/git log 로 자명하지 않음.

**Decision**:

1. **단일 테이블 컬럼** (별도 `series` 테이블 기각) — `posts.series VARCHAR(255) NULL` + `posts.series_order INT NULL` 두 컬럼 추가. 218 글 규모 + series 가 post 의 attribute 수준이라 별도 테이블 join 비용 회피. `tags JSON` (N:M, plan026) 와 모델링 차이 — series 는 post:series = N:1.
2. **`series` + `seriesOrder` 양쪽 모두 있어야 series 인정** — frontmatter 한쪽만 있으면 둘 다 NULL + `log.warn` drop. 이유: order 없는 series 는 prev/next 의미 없음. sync 단계에서 빠르게 drop 해 down-stream 코드 (Repository / page / Hero / Footer) 가 양쪽 동시 존재만 가정 → 분기 단순화.
3. **`seriesOrder == null` 가드 (`!seriesOrder` 기각)** — `series_order = 0` 이 valid 한 1번째 글 케이스. truthy 체크는 0 을 missing 으로 오인. `==`/`!=` 명시 사용 (`==='/`!==` 사용 금지). `posts/[...slug]/page.tsx` 인라인 주석으로도 보존.
4. **`/series/[name]` 만 (`/series` 인덱스 기각)** — tag 패턴과 일관 (`/tag` 인덱스도 OOS). 모든 시리즈 목록은 HomeHero `seriesCount` stat 으로만 노출. sitemap.xml 도 미포함 (tag 일관).
5. **`series_idx` 단일 컬럼 인덱스** — 218 글 규모에서 무시 가능하나 향후 확장 대비 명시. `(series, series_order)` 복합 인덱스 미채택 — 시리즈당 글 수 (평균 3~5) 가 작아 series 필터 후 in-memory order 정렬 비용 무시.

**Why (대안 기각)**:

- **별도 `series` 테이블 + `series_id FK`** 기각: 218 글 규모에서 join 비용이 모델 복잡도 대비 가치 낮음. 시리즈가 1000+ 가 되면 재검토.
- **`series` 만 있고 order 자동 추정 (sequence)** 기각: 글 추가 순서가 시리즈 순서와 다른 경우 (e.g. "1편" 을 늦게 작성) 자동 추정 실패. frontmatter 명시가 단순.
- **`!seriesOrder` truthy 체크** 기각: 위 #3 사유.
- **`/series` 인덱스 페이지** 기각: tag 와 일관성. `countSeries()` stat 만으로 사용자 인지 충분.
- **`series TEXT`** 기각: VARCHAR(255) 가 인덱스 가능 + MySQL 인덱스 키 제한 우회. 시리즈 이름 길이는 충분.

**Scope**: 본 ADR 결정은 plan033 한정. 시리즈 50+ 글 또는 `(series, series_order)` 정렬 hotspot 등장 시 복합 인덱스 / 캐시 / 별도 테이블 재검토.
