# 인기 글 목록 페이지

**Route:** `/posts/popular`
**진입점:** [인기 글 페이지](../../src/app/posts/popular/page.tsx)
**갱신일:** 2026-09-07

## 목적과 조회

방문 기록이 있는 활성 글을 조회수 순으로 계속 탐색한다.
홈의 인기 글 영역에서 진입하고 카드를 선택하면 글 상세로 이동한다.

- 첫 10개 경로를 서버에서 조회하고 이후 10개씩 추가 조회한다.
- 정렬은 `visit_count DESC, page_path ASC`이며 offset을 사용한다.
- 방문 기록이 없는 글은 목록에서 제외한다.
- 경로에 대응하는 활성 글이 없으면 카드를 생략하므로 표시 수는 조회한 경로 수보다 적을 수 있다.
- 추가 조회는 `/api/posts/popular`에서 수행한다.
- 카드에는 조회수를 함께 표시하고 비교에 적합한 row 변형을 사용한다.

동점의 순서를 유지하는 이유와 offset 선택은 [ADR-002](../adr/002-pagination.md)에 있다.

## 공통 목록 동작

로딩, 재시도, 종료 안내와 접근성은 [공통 글 목록 동작](../flow.md#글-목록의-공통-동작)을 따른다.
최초 조회 실패도 빈 목록과 종료 상태로 전달된다.
별도의 최초 조회 재시도 UI는 없으며 서버에 오류를 기록한다.

카드·대표 이미지 규칙은 [코드 아키텍처](../code-architecture.md#글-대표-이미지),
목록 상태 처리는 [PostsInfiniteList](../../src/components/PostsInfiniteList.tsx)가 담당한다.

## 색인과 갱신

`robots: { index: false, follow: true }`로 목록 자체의 색인을 제외한다.
조회수 변동에 맞춰 `revalidate = 600`으로 갱신하고 별도 정적 경로 목록은 생성하지 않는다.
색인 정책의 이유는 [ADR-005](../adr/005-list-page-noindex.md)에 있다.
