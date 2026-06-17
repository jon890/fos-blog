## ADR-002. 페이지네이션 — 최신=Cursor, 인기=Offset 혼합

**Context**: 무한 스크롤은 페이징 안정성이 핵심. 글 추가/변동 시 중복/누락 없어야 함.

**Decision**:

- **최신글**: Cursor `(updatedAt, id)` — `WHERE (updated_at, id) < (?, ?) ORDER BY updated_at DESC, id DESC`
- **인기글**: Offset + 2차 정렬 키 `pagePath` — `ORDER BY visit_count DESC, page_path ASC`

**Why**: 최신글은 sync 배치 중 동일 `updatedAt` 가능 → cursor 누락 방지 위해 `id` secondary 필수. 인기글은 `visitCount` 동점이 흔하지만 변동이 느려 offset+`pagePath` 정렬로 충분. 둘 다 offset(최신글 중복)/둘 다 cursor(인기글 SQL 복잡) 모두 기각. 인덱스 2개 추가 필요(`data-schema.md`).
