## ADR-006. IntersectionObserver 직접 구현 (의존성 미도입)

**Context**: 무한 스크롤 트리거 구현 방법.

**Decision**: 네이티브 `IntersectionObserver` 직접 사용. `react-intersection-observer` 등 래퍼 미도입.

**Why**: 번들 0 추가 + 10줄 패턴으로 충분 + MVP 의존성 최소 정책. `useEffect` + `useRef(observer)` 로 인스턴스 고정 + cleanup.
