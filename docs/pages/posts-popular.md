# 인기 글 목록 — Page PRD

**Route:** `/posts/popular`
**File:** `src/app/posts/popular/page.tsx`
**Updated:** 2026-04-19

---

## Purpose

전체 글을 **방문수 순**으로 연속 탐색할 수 있는 전용 페이지. SSR로 첫 10개를 렌더하고, 이후 무한 스크롤로 추가 로드한다.

`visit_stats` 에 등록된 글만 노출한다 (미방문 글은 목록에 없음 — 의도적 동작).

---

## Data

| Source | Method | Returns |
|---|---|---|
| VisitRepository | `getPopularPostPathsOffset({ limit: 10, offset: 0 })` | 인기 경로 10개 + visitCount |
| VisitRepository | `getPopularPostPathsTotal()` | `visit_stats` row 총수 (hasMore 계산) |
| PostRepository | `getPostsByPaths(paths)` | 경로 대응 글 상세 |

**정렬**: `visit_count DESC, page_path ASC` — 2차 정렬로 페이지 간 안정성 확보 ([ADR-002](../adr.md#adr-002))

**ISR:** `revalidate = 600` (10분 — 방문수 변동 느림)
**Static params:** 없음

**에러 처리:** DB 에러 시 빈 배열 폴백 + BLG2 로깅

---

## Components

| Component | Role |
|---|---|
| `PostsListSubHero` (accent=`"popular"`) | 페이지 eyebrow + h1 + Flame accent + meta + divider (server, plan016) |
| `PostsInfiniteList` (mode=`"popular"`) | 클라이언트 — IntersectionObserver + 수동 버튼 + 끝 도달 UX |
| `PostCard` | 각 글 카드 (visitCount 표시) |
| `PostCardSkeleton` | 로딩 스켈레톤 (3개) |
| `BackToTopButton` | 플로팅 + 인라인 공용 |

---

## Interactions

| Trigger | Action |
|---|---|
| 바닥 sentinel 가시화 | `fetch('/api/posts/popular?limit=10&offset=N')` |
| "더 보기" 버튼 클릭 | 동일 fetch |
| 추가 fetch 성공 | items append, offset 증가 |
| 추가 fetch 실패 | 인라인 "재시도" 버튼 (동일 offset) |
| `hasMore === false` | "더 이상 글이 없습니다." + "맨 위로" 버튼 |
| 스크롤 > 300px | 플로팅 "맨 위로" 버튼 노출 |
| PostCard 클릭 | `/posts/<path>` 이동 |

---

## SEO

- `export const metadata = { robots: { index: false, follow: true } }` ([ADR-005](../adr.md#adr-005))
- 제목: "인기 글 — FOS Study"
- 설명: "개발 공부 기록 블로그의 방문수 기준 인기 글 목록입니다."

---

## Layout

```
[Container max-w-[1180px]]
  [PostsListSubHero eyebrow="INDEX · POPULAR" title="인기 글" meta="방문수 순" accent="popular"]
   └ h1 우측 Flame 아이콘 (--color-cat-algorithm, hue 25 orange-red)
[PostsInfiniteList mode="popular"]
  ├ PostCard × N (visitCount 강조)
  ├ [스켈레톤 × 3 | 인라인 "더 보기" 버튼 | "재시도" 버튼 | 끝 문구 + 인라인 "맨 위로"]
[플로팅 BackToTop 버튼 (스크롤 > 300px)]
```

---

## Edge Cases

| 상황 | 처리 |
|---|---|
| `visit_stats` 비어 있음 (신규 배포 직후 등) | "아직 인기 글이 없습니다." (끝 도달 문구와 동일 처리) |
| 총 인기 글 < 10 | SSR 렌더 후 즉시 `hasMore = false` 로 끝 UX |
| `visitCount` 동점 다수 | `page_path ASC` 2차 정렬로 결정적 순서 보장 |

---

## Related Files

- `src/app/posts/popular/page.tsx` (신규)
- `src/app/api/posts/popular/route.ts` (신규)
- `src/components/PostsInfiniteList.tsx` (공용, posts-latest 참조)
- `src/components/PostCardSkeleton.tsx` (공용)
- `src/components/BackToTopButton.tsx` (공용)
- `src/infra/db/repositories/VisitRepository.ts` (메서드 추가)
- `src/infra/db/repositories/PostRepository.ts` (기존 `getPostsByPaths` 재사용)
