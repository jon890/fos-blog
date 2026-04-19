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
  - `src/app/opengraph-image.tsx` (홈)
  - `src/app/categories/opengraph-image.tsx`
  - `src/app/category/[...path]/opengraph-image.tsx`
  - `src/app/posts/[...slug]/opengraph-image.tsx`
- ISR `revalidate = 60` (글 페이지와 동기 맞춤)

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
- 동적 이미지 alt 텍스트는 각 `opengraph-image.tsx` 의 `export const alt` 로 페이지별 지정

**Follow-ups**:
- 빌드 후 Facebook Sharing Debugger / Twitter Card Validator / Google Rich Results Test 로 전수 검증
- 향후 다크/라이트 변형, 카테고리별 색상 테마 고려 가능

---

## ADR-008. 동적 OG 폰트 — 로컬 subset 파일 번들

**Context**: `ImageResponse` 로 한글 렌더 시 폰트 지정 필수. 외부 CDN(Google Fonts) fetch는 홈서버에서 네트워크 의존성 + 실패 시 렌더 불가.

**Decision**: **Noto Sans KR Bold** 를 Unicode Hangul Syllables 블록 전체(`U+AC00-D7A3`, 11,172자) + ASCII 로 **subset 한 woff2 파일을 `public/fonts/` 에 번들**.
- subset 스크립트: `scripts/build-og-fonts.py` (pyftsubset 기반) — 재현 가능
- 결과물: `public/fonts/NotoSansKR-Bold-subset.woff2` (목표 ~500KB, 한도 800KB)
- `ImageResponse` 는 Node `fs.readFile` 로 로컬 파일 로드 후 `fonts` 옵션에 전달

**Drivers**:
- 홈서버 외부의존성 제거 (네트워크 장애 시에도 OG 이미지 정상 생성)
- **모든 한글 렌더 보장** — KS X 1001 2350자로 제한하면 최신 합성 음절(ㅆ, ㅎ 이중받침 조합 등) 누락 위험. Unicode 한글 음절 블록 전체로 풀 렌더
- 원본 1.2MB → subset ~500KB 로 번들 경량화 (여전히 절반 이상 절감)
- 스크립트로 재생성 가능 → Noto 업데이트 시 커맨드 1회 실행

**Alternatives Considered**:
- **원본 woff2 그대로 번들**: 간단하지만 1.2MB. standalone 이미지 크기 증가. 기각
- **Google Fonts runtime fetch**: 네트워크 의존성. 기각

**Consequences**:
- Python + fonttools 도커/CI 환경에서 subset 재생성 가능
- `scripts/build-og-fonts.py` README 와 실행 가이드 필요

---

## ADR-009. `ImageResponse` 런타임 — Node.js 명시

**Context**: `next/og` `ImageResponse` 는 기본 Edge runtime. 홈서버 standalone 에서는 Node.js 우선.

**Decision**: 각 `opengraph-image.tsx` 에 `export const runtime = "nodejs"` 명시.

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
