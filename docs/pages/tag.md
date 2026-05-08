# /tag/[name] — 태그 글 목록 페이지

## 목적

특정 태그가 달린 글 목록 표시. tag 별 진입 경로 제공 (ADR-023). 존재하지 않는 tag 는 `notFound()` 반환.

## 컴포넌트 구성

| 컴포넌트 | 역할 |
|---|---|
| `PostsListSubHero` | eyebrow="TAG", title=`#${tag}`, meta=`${total} POSTS` 헤더 |
| `PostCard` | variant="grid" 카드, posts 배열 렌더 |

## 데이터 흐름

`params.name` → `decodeURIComponent(name)` → `post.getPostsByTag(tag, { limit: 50 })` + `post.countPostsByTag(tag)` 병렬 호출. total=0 이면 `notFound()`.

## revalidate

`export const revalidate = 300` (ISR 5분). ADR-023 결정 — 새 글 sync 후 tag 목록 반영 지연 최소화.

## Notes

- `limit=50` 고정 (ADR-023) — pagination 미구현 의도적 OOS
- URL 인코딩: `params.name` 은 인코딩 상태로 수신 → `decodeURIComponent` 필수
- `/tags` 전체 tag cloud 인덱스 페이지는 OOS (ADR-023)
- `generateStaticParams` 없음 — 동적 렌더 (tag 목록 변동성)
