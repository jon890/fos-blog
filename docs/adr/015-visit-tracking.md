## ADR-015. Visit tracking 경로 유효성 + middleware 분리

**Context**: SQL injection 시도 등 비유효 경로(`interview/...XOR(sleep(15))...`)가 `visit_stats` 에 누적되어 통계 과대 계상. 기존 `proxy.ts` 가 정규식 매칭 외 글 존재 검증 없이 모든 요청 기록.

**Decision**:

- **DB 존재 검증**: `posts.path` 가 실제 존재할 때만 기록 (비활성 글 `is_active=0` 도 보존)
- **Skip**: `/posts/latest`, `/posts/popular` 는 noindex 리스트 → DB 조회 없이 early return
- **길이 가드**: `pathname.length > 300` 차단
- **파일 분리**: `src/middleware/visit.ts` + `src/middleware/rateLimit.ts` (ADR-016) → `src/proxy.ts` 는 thin orchestrator
- **Cleanup**: `drizzle-kit generate --custom` 일회성 마이그레이션. 활성/비활성 무관 `posts.path` 매치 row 보존, 그 외(홈 `/` 제외) 삭제

**Why**: 통계 정합성 + 로그 오염 차단 + middleware 단일 책임. middleware 가 이미 Node Runtime(`crypto`/`getDb` 직접 사용) 이라 DB 조회 자유. `getPostId` 추가 쿼리는 `waitUntil` 내부 — 응답 지연 0. `console.error` → BLG2 4-field logger 교체. 정규식 화이트리스트만(존재 안 하는 글 통과) 기각.
