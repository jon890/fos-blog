# 최신 글 목록 — Page PRD

**Route:** `/posts/latest`
**File:** `src/app/posts/latest/page.tsx`
**Updated:** 2026-04-19

---

## Purpose

전체 글을 **최신 업데이트순**으로 연속 탐색할 수 있는 전용 페이지. SSR로 첫 10개를 렌더하고, 이후 무한 스크롤로 추가 로드한다.

---

## Data

| Source | Method | Returns |
|---|---|---|
| PostRepository | `getRecentPostsCursor({ limit: 10 })` | 최신 10개 (SSR) |
| VisitRepository | `getPostVisitCounts(paths)` | 조회수 맵 |

**정렬**: `updated_at DESC, id DESC` (composite cursor — [ADR-002](../adr.md#adr-002))

**ISR:** `revalidate = 60`
**Static params:** 없음

**에러 처리:** DB 에러 시 빈 배열 폴백 — "글이 없습니다" 표시 + logger BLG2 패턴으로 에러 로깅

---

## Components

| Component | Role |
|---|---|
| `PostsListSubHero` | 페이지 eyebrow + h1 + meta + divider (server, plan016) |
| `PostsInfiniteList` (mode=`"latest"`) | 클라이언트 — IntersectionObserver + 수동 버튼 + 끝 도달 UX |
| `PostCard` | 각 글 카드 (visitCount 함께 표시) |
| `PostCardSkeleton` | 로딩 스켈레톤 (3개) |
| `BackToTopButton` | 플로팅(스크롤>300px) + 끝 도달 시 인라인 공용 |

---

## Interactions

| Trigger | Action |
|---|---|
| 바닥 sentinel 가시화 | `fetch('/api/posts/latest?limit=10&cursor=<iso>:<id>')` |
| "더 보기" 버튼 클릭 | 동일 fetch (키보드 사용자용) |
| 추가 fetch 성공 | items append, nextCursor 갱신 |
| 추가 fetch 실패 | 인라인 "재시도" 버튼 노출 (동일 cursor 재요청) |
| `nextCursor === null` | 상태 `done` — "더 이상 글이 없습니다." + "맨 위로" 버튼 |
| 스크롤 > 300px | 플로팅 "맨 위로" 버튼 노출 |
| PostCard 클릭 | `/posts/<path>` 이동 |

---

## SEO

- `export const metadata = { robots: { index: false, follow: true } }` ([ADR-005](../adr.md#adr-005))
- 제목: "최신 글 — FOS Study"
- 설명: "개발 공부 기록 블로그의 최신 글 목록입니다."

---

## Layout

```
[Container max-w-[1180px]]
  [PostsListSubHero eyebrow="INDEX · LATEST" title="최신 글" meta="업데이트 순"]
[PostsInfiniteList mode="latest"]
  ├ PostCard × N  (누적)
  ├ [스켈레톤 × 3 | 인라인 "더 보기" 버튼 | "재시도" 버튼 | 끝 문구 + 인라인 "맨 위로"]
[플로팅 BackToTop 버튼 (스크롤 > 300px)]
```

---

## Related Files

- `src/app/posts/latest/page.tsx` (신규)
- `src/app/api/posts/latest/route.ts` (신규)
- `src/components/PostsInfiniteList.tsx` (신규, 공용)
- `src/components/PostCardSkeleton.tsx` (신규, 공용)
- `src/components/BackToTopButton.tsx` (신규, 공용)
- `src/infra/db/repositories/PostRepository.ts` (메서드 추가)
- `src/infra/db/repositories/VisitRepository.ts` (기존 `getPostVisitCounts` 재사용)
