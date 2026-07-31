# /series/[name] — 시리즈 상세 페이지

## 목적

선택한 시리즈의 활성 글을 명시된 순서대로 탐색할 수 있는 목록을 제공한다.
존재하지 않거나 활성 글이 없는 시리즈는 404로 처리한다.

## 데이터 흐름

1. `params.name`을 `decodeURIComponent()`로 복원한다.
2. `post.getPostsBySeries(series)`로 활성 글을 조회한다.
3. Repository가 `seriesOrder` 오름차순으로 정렬한 결과를 반환한다.
4. 결과가 없으면 `notFound()`를 호출한다.

## 화면 구성

| 구성 요소 | 역할 |
| --- | --- |
| `PostsListSubHero` | 시리즈명과 전체 글 수 표시 |
| `PostCard` | `variant="grid"`로 글 정보 표시 |
| 순서 번호 | 목록의 1부터 시작하는 표시 순서 제공 |

글 목록은 순서 의미를 보존하도록 `<ol>`로 렌더링한다.
각 카드를 선택하면 해당 글 상세 페이지로 이동한다.

## 메타데이터와 갱신

- canonical URL은 인코딩된 시리즈명을 포함한다.
- Open Graph 제목과 설명에 시리즈명을 사용한다.
- `revalidate = 300`으로 최대 5분 간격으로 갱신한다.
- `generateStaticParams` 없이 요청 시 렌더링한다.

## 관련 파일

- `src/app/series/[name]/page.tsx`
- `src/infra/db/repositories/PostRepository.ts`
- `src/components/PostsListSubHero.tsx`
- `src/components/PostCard.tsx`
