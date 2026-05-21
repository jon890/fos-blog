# Code Architecture — 변경사항

**작성일:** 2026-04-19
**관련:** [prd.md](./prd.md) · [data-schema.md](./data-schema.md) · [adr.md](./adr.md)

---

## 1. 전체 레이어 (변경 없음)

```
app/ (routing)
  ↓
services/ (business logic)
  ↓
infra/db/ + infra/github/ (external)
  ↑
lib/ (shared utils)
```

이번 변경은 **기존 레이어를 따른다**. `app/` 내 페이지/API는 `services/`를 경유 또는 Repository를 직접 호출 (기존 홈페이지도 Repository 직접 호출 — 일관성 유지).

---

## 2. 신규 / 변경 파일 트리

```
src/
├── app/
│   ├── page.tsx                        [변경] 섹션 하단 CTA 버튼 추가
│   ├── posts/
│   │   ├── latest/
│   │   │   └── page.tsx                [신규] SSR 최신 10개 + PostsInfiniteList
│   │   ├── popular/
│   │   │   └── page.tsx                [신규] SSR 인기 10개 + PostsInfiniteList
│   │   └── [...slug]/page.tsx          (기존, 변경 없음)
│   └── api/
│       └── posts/
│           ├── latest/route.ts         [신규] cursor 기반 GET
│           └── popular/route.ts        [신규] offset 기반 GET
│
├── components/
│   ├── PostsInfiniteList.tsx           [신규] "use client" — IntersectionObserver + 수동 버튼
│   ├── PostsListSubHero.tsx            [plan016] 인덱스 eyebrow + h1 + meta + optional Flame accent
│   ├── PostCardSkeleton.tsx            [신규] 스켈레톤 1개
│   ├── BackToTopButton.tsx             [신규] 플로팅 + 인라인 공용
│   └── SectionCTAButton.tsx            [신규] 홈 섹션 하단 "더 보기" 버튼
│
├── infra/db/repositories/
│   ├── PostRepository.ts               [변경] getRecentPostsCursor 추가
│   └── VisitRepository.ts              [변경] getPopularPostPathsOffset,
│                                              getPopularPostPathsTotal 추가
│
└── infra/db/schema/
    ├── posts.ts                        [변경] posts_updated_at_id_idx 추가
    └── visitStats.ts                   [변경] visit_stats_count_path_idx 추가

drizzle/
└── <timestamp>_posts_popular_indexes.sql  [신규] pnpm db:generate 결과
```

---

## 3. 데이터 흐름

### 최신글 페이지

```
[GET /posts/latest]  (SSR)
  └─ PostRepository.getRecentPostsCursor({ limit: 10 })
  └─ VisitRepository.getPostVisitCounts(paths)
  └─ merge → PostsInfiniteList initialItems = [...]
       │
       ├─ IntersectionObserver 바닥 근처 감지
       │    └─ fetch('/api/posts/latest?limit=10&cursor=<iso>:<id>')
       │         └─ Route Handler
       │              └─ PostRepository.getRecentPostsCursor({ limit, cursor })
       │              └─ VisitRepository.getPostVisitCounts(paths)
       │              └─ response: { items, nextCursor }
       │
       └─ 수동 "더 보기" 버튼 (동일 fetch 트리거)
```

### 인기글 페이지

```
[GET /posts/popular]  (SSR)
  └─ VisitRepository.getPopularPostPathsOffset({ limit: 10, offset: 0 })
  └─ VisitRepository.getPopularPostPathsTotal()
  └─ PostRepository.getPostsByPaths(paths)
  └─ merge + reorder (visitCount DESC, path ASC)
  └─ PostsInfiniteList initialItems = [...]
       │
       ├─ fetch('/api/posts/popular?limit=10&offset=10')
       │    └─ Route Handler
       │         └─ VisitRepository.getPopularPostPathsOffset({ limit, offset })
       │         └─ VisitRepository.getPopularPostPathsTotal()
       │         └─ PostRepository.getPostsByPaths(paths)
       │         └─ response: { items, hasMore, nextOffset }
       │
       └─ 끝 도달 → nextCursor/hasMore 기반 종료
```

---

## 4. `PostsInfiniteList` 컴포넌트 (핵심)

**Props** (discriminated union — mode 별로 필요한 필드만 강제):

```ts
type PostItem = PostData & { visitCount: number };

type Props =
  | {
      mode: "latest";
      initialItems: PostItem[];
      initialNextCursor: string | null; // null → 더 이상 없음
    }
  | {
      mode: "popular";
      initialItems: PostItem[];
      initialOffset: number; // 다음 요청 offset = pathRows.length (visit_stats 기준, 비활성 포스트 포함)
      initialHasMore: boolean;
    };
```

평탄화 이유: `mode`와 페이지네이션 상태를 직접 매핑 — `mode === "latest"`면 `initialNextCursor`만 접근 가능, TS narrowing으로 cursor/offset 혼용 버그 차단.

**내부 상태**:

- `items` — 누적된 글 배열
- `status` — `"idle" | "loading" | "error" | "done"`
- `nextCursor` (latest 모드) / `nextOffset` (popular 모드)
- `sentinelRef` — 바닥 sentinel div ref
- `observerRef` — IntersectionObserver 인스턴스 ref

**핵심 로직 (의사코드)**:

```
loadMore():
  if status === "loading" || status === "done": return
  status = "loading"
  try:
    res = fetch(apiUrl(mode, next))
    items.append(res.items)
    next = (mode=latest) ? res.nextCursor : res.nextOffset
    if terminator(res): status = "done"
    else: status = "idle"
  catch:
    status = "error"

IntersectionObserver(sentinel, threshold=0.1) → loadMore()
Button onClick → loadMore()
```

"더 보기" 버튼은 `status === "idle"` 일 때만 노출 (loading/error/done 상태는 각자 고유 UI).

popular offset 진행은 **`visit_stats` 테이블 기준 `pathRows.length` 단위**로 증가 — 비활성 포스트 필터링으로 일부 `items`가 제외돼도 다음 요청에서 중복되지 않도록 API가 `nextOffset`을 명시적으로 응답.

**접근성**:

- `aria-live="polite"` 상태 영역
- 끝 도달 시 `role="status"`로 "더 이상 글이 없습니다." 안내
- 수동 버튼은 `<button>` + focus-visible ring (Tailwind)

---

## 5. API Route 응답 스펙

### `GET /api/posts/latest`

```
Query: limit?: number (default 10, max 30), cursor?: string  // "<iso8601>:<id>"
Response 200:
{
  items: Array<PostData & { visitCount: number }>,
  nextCursor: string | null   // null → 끝
}
Response 400: cursor 파싱 실패
Response 500: DB 오류 (logger.error with BLG2 4-field)
```

### `GET /api/posts/popular`

```
Query: limit?: number (default 10, max 30), offset?: number (default 0)
Response 200:
{
  items: Array<PostData & { visitCount: number }>,
  hasMore: boolean,
  nextOffset: number   // offset + pathRows.length (비활성 포스트 포함 기준)
}
Response 400: offset 음수/비정상
Response 500: DB 오류
```

`nextOffset`은 `visit_stats` 테이블 기준 — 비활성 포스트가 `items`에서 빠지더라도 다음 요청 시 이미 스킵한 paths를 재요청하지 않도록 보장.

### 캐시 정책

- 두 route 모두 `export const revalidate = <ISR 기준>` 혹은 `Cache-Control: public, s-maxage=...` 를 **설정하지 않는다** (무한 스크롤 추가 fetch는 동적)
- SSR 페이지(`/posts/latest`, `/posts/popular`) 에서만 `export const revalidate = 60` (최신) / `600` (인기)

---

## 6. Logger 컨벤션 준수 (BLG2)

모든 신규 API route / Repository 메서드에서 에러는 4-field 구조화:

```ts
const log = logger.child({ module: "app/api/posts/latest" });
log.error(
  { component: "api.posts.latest", operation: "GET", cursor, err },
  "failed to list latest posts",
);
```

---

## 7. 테스트 전략 (PRD 섹션 7 AC 10)

### 필수 (A)

- `PostRepository.getRecentPostsCursor` — 첫 페이지 / 중간 페이지 / 끝 / 동일 updatedAt tie-break
- `VisitRepository.getPopularPostPathsOffset` — 첫/중간/끝
- `VisitRepository.getPopularPostPathsTotal` — 0개 / 다수
- mock: 기존 `vi.mock()` 패턴 (기존 `SyncService.test.ts` 스타일 재활용)

### 필수 (B)

- `/api/posts/latest` route — 쿼리 파싱, 에러 응답, 정상 응답 shape
- `/api/posts/popular` route — 동일

### 범위 외

- 클라이언트 컴포넌트(`PostsInfiniteList`) 자동 테스트는 이번 범위 제외 — 수동 브라우저 검증으로 처리

---

## 마크다운 렌더 파이프라인 (plan014)

```
src/components/
├── MarkdownRenderer.tsx              # server, async — unified.process() + hast-util-to-jsx-runtime
├── CodeCard.tsx                      # client island, clipboard 복사
├── Mermaid.tsx                       # client island, SVG 렌더
├── lightbox/                         # client island, 본문 이미지 클릭 확대 (plan039)
│   ├── Lightbox.tsx                  # 모달 본체 + ESC/ArrowKey + 인접 ±1 prefetch
│   ├── LightboxImage.tsx             # next/image wrapper + 클릭/키보드 트리거 + linked image 가드
│   └── LightboxProvider.tsx          # Context + article scope DOM 쿼리
└── markdown/
    ├── unified-pipeline.ts           # server-only, processor lazy singleton (Promise 공유로 race 방지)
    ├── pretty-code-options.ts        # rehype-pretty-code 옵션 (dual theme, bypassInlineCode)
    ├── sanitize-schema.ts            # rehype-sanitize allowlist (shiki data-* / figure / heading id / KaTeX aria-hidden, clobberPrefix="") — ADR-026 / ADR-027
    └── components.tsx                # createMarkdownComponents factory (figure→CodeCard, pre→Mermaid, img→LightboxImage 분기)
```

**규칙**: `src/components/markdown/*` 는 server-only 모듈 (`import "server-only"` 가드). client 에서 import 시 빌드 에러. components mapping 으로 server tree 안에 client island 자연스럽게 주입 (RSC 표준 패턴). `react-markdown` 의존성 제거 — ADR-020 참조. unified chain 말미에 `rehype-sanitize` 가 `<script>` / `<iframe>` / `on*` / `javascript:` URL 을 차단 — ADR-026. `img` 핸들러는 `LightboxImage` 로 라우팅되어 `<article>` 안에서 클릭 시 lightbox 확대 — plan039 / `LightboxProvider` 가 article scope 정의.

---

## 8. 실패/회귀 방지

- **Common Pitfalls (`.claude/skills/_shared/common-pitfalls.md`) 사전 해소**:
  - P2 파일 범위: 본 문서 섹션 2 트리로 명시
  - P4 cwd: 구현 phase에서 모든 bash 블록에 `# cwd:` 주석
  - P5 기계적 검증: 테스트 명령만 사용 (pnpm test, pnpm type-check, pnpm lint)
  - P7 4면 검사 — 신규 불변식 없음 (기존 `is_active` 기반 필터 유지)
  - BLG1 db:push 금지 — `pnpm db:generate` → 커밋 → `pnpm db:migrate`
  - BLG2 구조화 로그 — 섹션 6 준수
  - BLG3 사일런트 실패 금지 — 500 + 에러 body

---

## 태그 시스템 (plan026)

신규 라우트 + Repository 메서드:

- **`GET /tag/[name]`** (`src/app/tag/[name]/page.tsx`) — tag 별 글 목록. ISR 300s. tag URL decode → `getPostsByTag(tag, { limit: 50 })` + `countPostsByTag`. count 0 이면 `notFound()`.
- **`PostRepository.getPostsByTag(tag, { limit, offset })`** / **`countPostsByTag(tag)`** — `JSON_CONTAINS(posts.tags, JSON_QUOTE(?))` 쿼리. count 는 `sql<string>\`count(*)\`` + `Number()` (BLG6).
- **`SyncService.normalizeTags(raw)`** — frontmatter 의 `tags` 를 `trim().toLowerCase()` + 빈 문자열 제거 + Set dedup 후 DB 저장.
- **`ArticleFooter`** — tag chip 을 `<Link href="/tag/{encoded}">` 로 활성화.

설계 의도 (정규화 테이블 회피, 50 limit, lowercase 만 등) 는 ADR-023 참조.

---

## RSS feed (plan027)

신규 라우트:

- **`GET /rss.xml`** (`src/app/rss.xml/route.ts`) — RSS 2.0 XML. `runtime = "nodejs"`, `revalidate = 600` (10분). Cache-Control `s-maxage=600, stale-while-revalidate=86400`. `escapeXml()` 인라인 헬퍼로 모든 사용자 입력 sanitize. `<atom:link rel="self">` 포함.
- **`PostRepository.getRecentActiveLite({ limit })`** (plan045) — `content` 컬럼 미포함 (title/path/slug/category/subcategory/folders/description/createdAt select), `isActive=true` 필터, `desc(createdAt)` 정렬. 캐시 미스 시 DB 트래픽 ~수MB → ~수KB 로 감소. RSS feed 가 description 만 사용하므로 content fallback 불요. description null 인 글은 빈 description 으로 RSS 출력 (suppress 안 함). 기존 `getRecentActive` 는 deprecated — 다른 호출자 없으면 제거 가능.
- **`src/app/layout.tsx`** — `metadata.alternates.types` 에 `application/rss+xml` link 추가 → Next.js 가 `<link rel="alternate" type="application/rss+xml" href="/rss.xml">` 자동 생성.
- **Rate limit**: `/rss.xml` 은 `proxy.ts` matcher 의 catch-all 영역에 포함 — `rateLimit` middleware (1000/min/IP fixed window, RFC1918/봇 우회) 자연 적용. `sitemap.xml` 만 exclusions 에 명시되어 있음 — RSS 는 동일 정책 적용.
- **Thundering herd**: 현재는 별도 mutex 없이 Next.js `revalidate=600` 만 의존. RSS reader polling 빈도 (보통 1시간+) 와 캐시 hit rate 가 충분히 높아 동시 다수 미스 사고 미관측. 향후 트래픽 증가 시 Promise singleton mutex 도입 검토 (plan025 unified-pipeline 의 `processorPromise` 패턴 재활용 가능).

---

## 시리즈 시스템 (plan033)

신규 라우트 + Repository 메서드:

- **`GET /series/[name]`** (`src/app/series/[name]/page.tsx`) — 시리즈별 글 목록. ISR 300s. URL decode → `getPostsBySeries(series)`. 0건이면 `notFound()`. `<ol>` + 번호 표시 (순서 의미 있음).
- **`PostRepository.getPostsBySeries(series)`** — `eq(posts.series, series)` + `asc(posts.seriesOrder)` 정렬. `Post[]` 반환.
- **`PostRepository.getSeriesNeighbors(post)`** — 같은 시리즈 전체 로드 후 `path` 기준 인접 글 반환. `{ prev, next, total }`.
- **`PostRepository.countSeries()`** — `count(distinct series)` + `isNotNull(series)`. HomeHero stat 용.
- **`ArticleHero`** — series prop 추가. meta row 에 `SERIES · {name} · {order}/{total}` 링크 표시.
- **`ArticleFooter`** — series chip + prev/next 카드 nav 추가. slug 인코딩은 PostCard 의 `postHref` 패턴과 동일.
- **`HomeHero`** — `seriesCount` 실값 연결 (`countSeries()`).

설계 의도 (RSS 2.0 vs Atom / pubDate=createdAt / 50 limit) 는 ADR-024 참조.

### 시리즈 발견성 (plan047)

plan033 의 OOS 였던 `/series` 인덱스 + 전역 진입점 추가.

- **`GET /series`** (`src/app/series/page.tsx`) — 시리즈 인덱스. ISR 300s. 카드 grid (`md:grid-cols-2`). 시리즈가 0건이면 `PostsListSubHero` + "아직 등록된 시리즈가 없습니다" 빈 상태.
- **`PostRepository.getAllSeries(limit?)`** — 2 쿼리로 N+1 회피.
  - (1) `GROUP BY series` aggregate — `(name, postCount, latestUpdatedAt, minSeriesOrder)` 수집, `MAX(updatedAt) DESC` 정렬
  - (2) `(series, series_order) IN (...)` 로 각 시리즈의 첫 글 fetch (`seriesOrder` 가 `minSeriesOrder` 인 row)
  - 메모리에서 `SeriesInfo` 로 조합. limit 미지정 시 전체 반환.
- **`SeriesInfo` 타입** (`src/infra/db/types.ts`) — `{ name, postCount, latestUpdatedAt, firstPost: { title, description, category, slug, path } }`.
- **`SeriesCard`** (`src/components/SeriesCard.tsx`) — 신규 컴포넌트. PostCard variant 가 아니라 별도 (ADR-028). 카테고리 chip · "N posts" 메타 · 시리즈명 · 첫 글 description (line-clamp-2) · latestUpdatedAt.
- **`Header`** — `navLinks` 에 `{ href: "/series", label: "03 / 시리즈", icon: Layers }` 추가.
- **메인 페이지 `src/app/page.tsx`** — 인기 글 / 최근 글 사이에 "시리즈" 섹션. `getAllSeries(4)` 호출 결과를 `SeriesCard` grid (`md:grid-cols-2`) 로. 시리즈 0건이면 섹션 자체 hide. "시리즈 더 보기" CTA → `/series`.

설계 의도 (별 컴포넌트 분리) 는 ADR-028 참조.

---

## SEO 색인 정책 (plan048)

Google Search Console "적절한 표준 태그가 포함된 대체 페이지" 알람 해소를 위한 정책.

### 글 URL 인코딩 일관성

글 path 는 슬래시를 보존하는 segment-encoding 패턴 (`path.split("/").map(encodeURIComponent).join("/")`) 으로만 인코딩한다.
`encodeURIComponent(fullPath)` 처럼 통째 인코딩하면 슬래시까지 `%2F` 로 변환되어 정상 슬래시 URL 과 별개로 크롤링되며, canonical 충돌로 alternate URL 누적이 발생한다.

적용 위치 (sync 7+1 곳):

- `src/components/PostCard.tsx` `postHref` — segment-encoding
- `src/components/SearchDialog.tsx` — segment-encoding
- `src/components/ArticleFooter.tsx` (series prev/next) — segment-encoding
- `src/app/posts/[...slug]/page.tsx` (canonical / OG image URL) — segment-encoding
- `src/app/sitemap.ts` post URL — segment-encoding
- `src/app/category/[...path]/page.tsx` (글 카드 href) — segment-encoding (plan048 에서 단독 인코딩에서 전환)

### 글 단위 noindex (frontmatter `index: false`)

폴더 단위 sync 차단은 `src/infra/github/file-filter.ts` 의 `EXCLUDED_FILENAMES`.
글 단위 색인 차단은 frontmatter `index: false` — `generateMetadata` 에서 `robots: { index: false, follow: true }` 로 매핑.
두 정책 도메인 분리:

- file-filter — 사전 차단 (DB 에 동기화 자체 안 함)
- frontmatter index — 사후 차단 (DB 동기화 + 페이지 렌더는 하되 검색엔진에만 비노출)

현재 frontmatter `index: false` 적용 글은 없음 — 향후 비공개 전환 필요한 글에 대비한 인프라.

### robots.txt `/api/` 차단 정책 (plan049)

`src/app/robots.ts` 는 `/api/` 와 `/_next/` 를 disallow.
다만 `/api/og/` 는 OG 이미지 동적 생성 endpoint 라 SNS 공유 / Google Image Search 노출에 필요 — `allow: ["/", "/api/og/"]` 예외 처리.

Google robots.txt 매칭은 가장 구체적인 (긴) 경로 우선:

- `/api/og/posts/x.md` — `allow:/api/og/` (10 chars) 가 `disallow:/api/` (5 chars) 보다 우선 → 크롤 허용
- `/api/sync` — `disallow:/api/` (5 chars) 가 `allow:/` (1 char) 보다 우선 → 차단 유지

다른 `/api/*` 엔드포인트 (`comments` / `posts/{latest,popular}` / `search` / `sync` / `visit`) 는 모두 인덱싱 가치 없어 차단 유지.

---

## sync 자가 치유 metadata (plan037)

- **`CategoryRepository.syncAll(stats)`** — UPSERT (`onDuplicateKeyUpdate` on `name`) + orphan DELETE (`notInArray(categories.name, currentNames)`). 기존 `replaceAll` (DELETE all + INSERT all) 대체. id 안정성 + 변경 없는 row 의 `updatedAt` 미터치. `stats.length === 0` 분기로 빈 입력 시 전체 row 삭제 명시.
- **`SyncService.sync` short-circuit path** — `lastSyncedSha === headSha` 분기에서도 `metadataSyncService.updateCategories()` + `syncFolderReadmes()` 호출. posts 변경 없어도 categories drift (예: GitHub 측 디렉터리 통째 삭제 후 sync) 자가 치유. 응답 shape (`upToDate: true, deleted: 0`) 는 그대로 — metadata 재계산은 caller-invisible 부수효과.
