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
      initialNextCursor: string | null;      // null → 더 이상 없음
    }
  | {
      mode: "popular";
      initialItems: PostItem[];
      initialOffset: number;                 // 다음 요청 offset = pathRows.length (visit_stats 기준, 비활성 포스트 포함)
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
  "failed to list latest posts"
);
```

---

## 7. 테스트 전략 (PRD §7 AC 10)

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

## 8. 실패/회귀 방지

- **Common Critic Patterns (`.claude/skills/_shared/common-critic-patterns.md`) 사전 소진**:
  - P2 파일 범위: 본 문서 §2 트리로 명시
  - P4 cwd: 구현 phase에서 모든 bash 블록에 `# cwd:` 주석
  - P5 기계적 검증: 테스트 명령만 사용 (pnpm test, pnpm type-check, pnpm lint)
  - P7 4면 검사 — 신규 불변식 없음 (기존 `is_active` 기반 필터 유지)
  - BLG1 db:push 금지 — `pnpm db:generate` → 커밋 → `pnpm db:migrate`
  - BLG2 구조화 로그 — §6 준수
  - BLG3 사일런트 실패 금지 — 500 + 에러 body
