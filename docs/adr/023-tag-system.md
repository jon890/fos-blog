## ADR-023. 태그 시스템 — `posts.tags JSON` + `JSON_CONTAINS` (plan026)

**Context**: issue #72 — 글 frontmatter 의 `tags` 를 DB 에 저장하고 tag 별 글 목록 페이지를 제공. 모델링 선택지가 둘이라 결정 의도 보존이 필요.

**Decision**:

1. **`posts.tags JSON NOT NULL DEFAULT ('[]')`** — 별도 `tags` / `post_tags` 정규화 테이블 대신 `posts` 의 JSON 컬럼. `folders` 와 같은 패턴 (이미 존재).
2. **조회**: `JSON_CONTAINS(tags, JSON_QUOTE(?))` — `?` 바인딩으로 SQL injection 안전. 인덱스 미사용 (full table scan).
3. **`/tag/[name]`** — 5분 ISR, `limit=50`, 존재하지 않는 tag 는 `notFound()`. `/tags` 인덱스 (전체 tag cloud) 는 OOS.
4. **정규화**: `trim().toLowerCase()` + 빈 문자열 제거 + `Set` dedup. 한글-영문 동의어 매핑 / 대소문자 별 분리는 OOS.

**Why (대안 기각)**:

- **정규화 테이블 (`tags` + `post_tags` join)** 기각: 218 글 × 평균 3-6 tag 규모에서 join 비용 vs JSON_CONTAINS full-scan 비용 차이 무시 가능. 별도 테이블 도입 시 schema 복잡도 + 마이그레이션 비용 큼. 향후 글 수가 1000+ 로 늘고 tag 검색이 성능 병목이 되면 별도 plan 으로 정규화 검토.
- **`limit=50`**: 한 tag 가 50 글 넘는 경우는 사실상 카테고리 수준 — pagination 보다 카테고리 분리가 자연스러움. pagination 미구현은 의도된 OOS.
- **`/tags` 인덱스 OOS**: 인덱스 페이지는 navigation 가치가 낮고 SEO 도 카테고리로 충분. 필요 시 별도 plan.
- **한글-영문 동의어 매핑 OOS**: 글 작성자 (jon890) 가 frontmatter 작성 시 일관성 유지하는 게 더 단순. 매핑 테이블 도입은 복잡도 대비 이익 작음.

**Scope**: 본 ADR 결정은 plan026 한정. 글 수 1000+ / tag 100+ 도달 시 정규화 테이블 + 인덱스 재검토.
