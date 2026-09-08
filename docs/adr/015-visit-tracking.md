## ADR-015. Visit tracking 경로 유효성 + middleware 분리

**Context**: SQL injection 시도 등 비유효 경로(`interview/...XOR(sleep(15))...`)가 `visit_stats` 에 누적되어 통계 과대 계상. 기존 `proxy.ts` 가 정규식 매칭 외 글 존재 검증 없이 모든 요청 기록.

**Decision**:

- **DB 존재 검증**: `posts.path` 가 실제 존재할 때만 기록 (비활성 글 `is_active=0` 도 보존)
- **Skip**: `/posts/latest`, `/posts/popular` 는 noindex 리스트 → DB 조회 없이 early return
- **길이 가드**: `pathname.length > 300` 차단
- **파일 분리**: 방문 기록은 `src/middleware/visit.ts`, 요청 제한은 `src/middleware/rateLimit.ts`로 나눈다 (ADR-016).
  `src/proxy.ts`는 두 처리를 조합한다.
- **Cleanup**: `drizzle-kit generate --custom` 일회성 마이그레이션. 활성/비활성 무관 `posts.path` 매치 row 보존, 그 외(홈 `/` 제외) 삭제

**Why**: 잘못된 방문 기록을 차단하고 middleware의 책임을 분리한다.
middleware는 이미 Node Runtime에서 `crypto`와 `getDb`를 직접 사용하므로 DB 조회가 가능하다.
`getPostId` 추가 쿼리는 `waitUntil` 내부에서 실행해 응답 전에 기다리지 않는다.
오류는 [구조화 로그](../code-architecture.md#로깅과-오류)로 기록한다.
존재하지 않는 글도 통과하는 정규식 허용 목록만 사용하는 대안은 기각했다.
