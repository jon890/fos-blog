## ADR-001. 무한 스크롤 페이지 — SSR 첫 페이지 + 클라이언트 fetch 하이브리드

**Context**: 홈에서 인기/최신 6개씩만 노출, 전체 200개 글 탐색 경로 부재.

**Decision**: 전용 페이지 `/posts/latest`, `/posts/popular` 신설. 첫 10개 SSR + 이후 클라이언트 `fetch` 무한 스크롤.

**Why**: SEO 보존 + 빠른 FCP + 끊김 없는 스크롤. 통합 페이지(상태 복잡)/풀 CSR(SEO 손해)/페이지네이션(체감 느림) 모두 기각. 페이지 자체는 noindex(ADR-005). 뒤로가기 시 state 초기화는 감수 — 필요 시 sessionStorage 복원 추후 검토.
