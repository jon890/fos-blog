## ADR-005. 리스트 페이지 `noindex`

**Context**: 리스트 페이지는 검색엔진 가치 낮고 중복 콘텐츠 가능성(글 제목 이미 홈/카테고리에 노출).

**Decision**: `/posts/latest`, `/posts/popular` 모두 `robots: { index: false, follow: true }`.

**Why**: 검색 결과 CTR 희석 방지 + 개별 글 페이지로 색인 집중. `follow: true` 유지 → 크롤러가 리스트 통해 글까지 도달.
