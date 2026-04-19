# PRD — 최신/인기 글 목록 페이지 (무한 스크롤)

**작성일:** 2026-04-19
**상태:** 확정 (구현 예정)
**관련 pages PRD:** [posts-latest](./pages/posts-latest.md) · [posts-popular](./pages/posts-popular.md) · [home](./pages/home.md)

---

## 1. 문제 정의

홈페이지에서 인기 글 / 최근 글을 각 6개만 노출한다. 방문자가 더 많은 글을 탐색하려면 카테고리별 페이지로 진입하는 방법뿐이며, **전체 글을 최신순 또는 인기순으로 훑어볼 수 있는 경로가 없다**.

현재 전체 글 수는 약 200개 — 홈의 6개는 전체의 3%에 불과하다.

---

## 2. 목표

- 방문자가 전체 글을 **최신순 / 인기순으로 연속 탐색**할 수 있는 전용 페이지 제공
- **SEO 손해 없이** (첫 10개 SSR) + **스크롤 UX** (이후 무한 로드)
- 200개 규모에서 **빠른 응답** (p95 < 300ms per page fetch)
- **접근성**: 키보드 / 스크린리더 사용자도 동일하게 탐색 가능 (수동 "더 보기" 버튼 병행)

---

## 3. 범위

### In Scope
- 최신 글 목록 페이지 `/posts/latest` (cursor 기반 무한 스크롤)
- 인기 글 목록 페이지 `/posts/popular` (offset 기반 무한 스크롤)
- 홈페이지 두 섹션 하단에 **"최신 글 더 보기 / 인기 글 더 보기"** CTA 버튼
- Repository 신규 메서드 2개 + API Route 2개
- DB 인덱스 2개 추가 (정렬 성능)

### Out of Scope
- 카테고리별 무한 스크롤 (`/category/*`) — 글 수가 적어 기존 정적 방식 유지
- URL에 페이지 상태 반영 (`?page=N`) — Q8 결정: 스크롤 위치만 복원
- sessionStorage 기반 뒤로가기 시 로드된 목록 복원 — Q14 결정: 단순하게 가고 추후 추가 구현 여지
- 필터 (카테고리/기간) — 이번 범위 아님

---

## 4. 페이지당 개수 / 진입 경로

| 항목 | 값 |
|---|---|
| 페이지당 글 수 | 10 |
| 초기 SSR 수 | 10 |
| 추가 로드 단위 | 10 |
| 진입 경로 | 홈 각 섹션 하단 CTA 버튼 (강조) |

---

## 5. 로딩 / 끝 도달 UX

| 상태 | 처리 |
|---|---|
| 로딩 중 (추가 fetch) | PostCard 스켈레톤 3개 |
| 추가 로드 실패 | 인라인 "재시도" 버튼 (같은 cursor/offset 재시도) |
| 끝 도달 (인기/최신 공통) | "더 이상 글이 없습니다." 문구 + "맨 위로" 버튼 |
| 스크롤 300px 이상 | 플로팅 "맨 위로" 버튼 노출 |

---

## 6. 비기능 요구사항

| 항목 | 기준 |
|---|---|
| SSR 첫 페이지 p95 | < 300ms |
| 추가 fetch p95 | < 300ms |
| ISR | 최신=60초, 인기=600초(10분) |
| 신규 의존성 | 0개 (IntersectionObserver 직접 구현) |
| SEO | `robots: { index: false }` — 리스트는 색인 제외 |
| 접근성 | `aria-live="polite"` 로딩 상태 안내, "더 보기" 버튼 키보드 조작 가능 |

---

## 7. 수용 기준 (Acceptance Criteria)

1. 홈페이지 "최신 글" / "인기 글" 섹션 하단에 CTA 버튼 표시 — 클릭 시 `/posts/latest` / `/posts/popular` 이동
2. `/posts/latest` 진입 시 SSR로 최신 10개 렌더 (`updatedAt DESC, id DESC` 정렬)
3. `/posts/popular` 진입 시 SSR로 인기 10개 렌더 (`visitCount DESC, pagePath ASC` 정렬, `visitStats` 등록된 글만)
4. 스크롤 바닥 근처 도달 시 다음 10개 자동 로드 — 스켈레톤 3개 노출
5. "더 보기" 버튼으로도 동일 동작 (키보드만 사용 가능)
6. 끝 도달 시 "더 이상 글이 없습니다." + "맨 위로" 버튼
7. 추가 fetch 실패 시 인라인 "재시도" 버튼, 클릭 시 동일 cursor/offset 재요청
8. 두 페이지 모두 PostCard에 `visitCount` 함께 표시 (홈 "최근 글"과 일관성)
9. `meta robots = noindex`
10. Repository 신규 메서드 단위 테스트 + API Route 통합 테스트 통과

---

## 8. 관련 docs

- [flow.md](./flow.md) — 사용자 흐름 (상세)
- [data-schema.md](./data-schema.md) — DB 인덱스 추가 마이그레이션
- [code-architecture.md](./code-architecture.md) — Repository / Service / API / Component 구조
- [adr.md](./adr.md) — ADR-001 ~ ADR-005
