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
- [ADR-008](#adr-008) — Noto Sans KR subset TTF 로컬 번들
- [ADR-009](#adr-009) — `ImageResponse` 런타임 = Node.js
- [ADR-011](#adr-011) — catch-all OG 이미지 = API Route 우회

### 도메인 & SEO 검색 노출

- [ADR-013](#adr-013) — 메인 도메인 단일화 (`blog.fosworld.co.kr`, `/ads.txt` 만 예외)
- [ADR-014](#adr-014) — AdSense 승인 요건 (privacy/about/contact + GitHub 프로필 fetch)

### 보안 & 안정성

- [ADR-015](#adr-015) — Visit tracking 경로 유효성 + middleware 분리
- [ADR-016](#adr-016) — Rate limit middleware (60/min/IP, Googlebot 예외)

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

## ADR-008. 동적 OG 폰트 — 로컬 subset TTF 번들

**Context**: `ImageResponse` 한글 렌더에 폰트 필수. CDN fetch 는 홈서버 네트워크 의존.

**Decision**: Noto Sans KR Bold 를 Unicode Hangul Syllables 전체(`U+AC00-D7A3`, 11,172자) + ASCII 로 subset → `public/fonts/NotoSansKR-Bold-subset.ttf` (~1.6MB). 스크립트 `scripts/build-og-fonts.py` (pyftsubset) 로 재현.

**Why**: 홈서버 외부 의존 0 + 모든 한글 렌더 보장(KS X 1001 2350자는 신생 음절 누락). **TTF 고정 이유**: `ImageResponse.fonts` 가 TTF/OTF/WOFF 만 지원, **WOFF2 미지원** (satori 제약). woff2(미지원)/woff(satori 호환 불확실)/원본 TTF(과대)/Google Fonts fetch(의존) 모두 기각. TTF 1.6MB 는 서버 번들 전용 — 클라이언트 전송 0. Dockerfile `COPY public` 필수.

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

- **위치**: `src/middleware/rateLimit.ts` — 홈서버 1 인스턴스라 in-memory `Map` 으로 충분
- **알고리즘**: Fixed window 60초/IP — `Math.floor(Date.now() / 60_000)` 분 단위 버킷
- **한도**: 분당 60 요청/IP. 초과 시 429 + `Retry-After: 60`
- **봇 예외**: User-Agent `Googlebot` 매치 시 우회
- **matcher**: `/((?!_next/static|_next/image|favicon|logo|og-default|fonts/).*)` — 정적 자산 제외

**Why**: 홈서버 보호 + 외부 의존 0(Redis/Upstash 미도입) + 1 인스턴스에 충분. NPM `limit_req`(사용자가 Next.js 명시)/Redis(멀티 인스턴스 계획 없음)/Sliding window(burst 60×2 도 실용 OK) 기각. UA 위조 가능성 인지 — 보호 본질은 60/min 한도 자체, 봇 예외는 합법 크롤러 수용. 매 분 윈도우 갱신 시 entry 자연 갱신 → 별도 GC 불필요.
