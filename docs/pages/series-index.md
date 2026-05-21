# /series — 시리즈 인덱스 페이지

## 목적

블로그에 등록된 모든 시리즈를 한 곳에서 발견할 수 있는 진입점. plan033 의 시리즈 시스템에서 의도적으로 OOS 였던 부분을 plan047 에서 채움.

## 컴포넌트 구성

| 컴포넌트 | 역할 |
|---|---|
| `PostsListSubHero` | eyebrow="SERIES", title="시리즈", meta=`${total} SERIES` 헤더 |
| `SeriesCard` (plan047) | 시리즈 카드 — 카테고리 chip · "N posts" · 시리즈명 · 첫 글 description · latestUpdatedAt |

## 데이터 흐름

`post.getAllSeries()` 단일 호출. `SeriesInfo[]` 를 `latestUpdatedAt DESC` 정렬 상태로 반환받아 `SeriesCard` grid 에 매핑.

시리즈 0건이면 `notFound()` 대신 빈 상태 메시지 ("아직 등록된 시리즈가 없습니다") — 시리즈는 선택적 메타라 부재가 자연스러움.

## revalidate

`export const revalidate = 300` (ISR 5분). 새 글 sync 후 시리즈 인덱스 반영 지연을 태그 페이지와 동일하게 맞춤.

## Notes

- 정렬: `latestUpdatedAt DESC` — "활발한 시리즈가 위" (plan047 결정)
- 카드 시각 언어: `PostCard` grid variant 와 의도적 일치 — border / hover / 카테고리 chip / typography 토큰 동일. 별 컴포넌트로 분리한 이유는 도메인 차이 (ADR-028)
- pagination 미구현 — 시리즈 수는 글 수보다 훨씬 적어 limit 없이 전체 fetch
- URL 인코딩: `/series` 자체는 정적. 카드 클릭 시 `/series/<encodeURIComponent(name)>` 로 이동
- `generateStaticParams` 없음 — 동적 렌더 (시리즈 목록 변동성)
