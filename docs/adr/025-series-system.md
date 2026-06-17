## ADR-025. 시리즈 시스템 — `posts.series VARCHAR + series_order INT` + 양쪽 필수 정책 (plan033)

**Context**: issue #127 — 다회 포스트 시리즈를 묶어 prev/next 네비게이션 + 시리즈 인덱스 페이지 제공. 데이터 모델, 누락 처리, URL 패턴, 인덱스 전략 4 결정이 코드/git log 로 자명하지 않음.

**Decision**:

1. **단일 테이블 컬럼** (별도 `series` 테이블 기각) — `posts.series VARCHAR(255) NULL` + `posts.series_order INT NULL` 두 컬럼 추가. 218 글 규모 + series 가 post 의 attribute 수준이라 별도 테이블 join 비용 회피. `tags JSON` (N:M, plan026) 와 모델링 차이 — series 는 post:series = N:1.
2. **`series` + `seriesOrder` 양쪽 모두 있어야 series 인정** — frontmatter 한쪽만 있으면 둘 다 NULL + `log.warn` drop. 이유: order 없는 series 는 prev/next 의미 없음. sync 단계에서 빠르게 drop 해 down-stream 코드 (Repository / page / Hero / Footer) 가 양쪽 동시 존재만 가정 → 분기 단순화.
3. **`seriesOrder == null` 가드 (`!seriesOrder` 기각)** — `series_order = 0` 이 valid 한 1번째 글 케이스. truthy 체크는 0 을 missing 으로 오인. `==` / `!=` 명시 사용 (`===` / `!==` 사용 금지 — `null` 과 `undefined` 둘 다 잡아야 함). `posts/[...slug]/page.tsx` 인라인 주석으로도 보존.
4. **`/series/[name]` 만 (`/series` 인덱스 기각)** — tag 패턴과 일관 (`/tag` 인덱스도 OOS). 모든 시리즈 목록은 HomeHero `seriesCount` stat 으로만 노출. sitemap.xml 도 미포함 (tag 일관).
5. **`series_idx` 단일 컬럼 인덱스** — 218 글 규모에서 무시 가능하나 향후 확장 대비 명시. `(series, series_order)` 복합 인덱스 미채택 — 시리즈당 글 수 (평균 3~5) 가 작아 series 필터 후 in-memory order 정렬 비용 무시.

**Why (대안 기각)**:

- **별도 `series` 테이블 + `series_id FK`** 기각: 218 글 규모에서 join 비용이 모델 복잡도 대비 가치 낮음. 시리즈가 1000+ 가 되면 재검토.
- **`series` 만 있고 order 자동 추정 (sequence)** 기각: 글 추가 순서가 시리즈 순서와 다른 경우 (e.g. "1편" 을 늦게 작성) 자동 추정 실패. frontmatter 명시가 단순.
- **`!seriesOrder` truthy 체크** 기각: 위 #3 사유.
- **`/series` 인덱스 페이지** 기각: tag 와 일관성. `countSeries()` stat 만으로 사용자 인지 충분.
- **`series TEXT`** 기각: VARCHAR(255) 가 인덱스 가능 + MySQL 인덱스 키 제한 우회. 시리즈 이름 길이는 충분.

**Scope**: 본 ADR 결정은 plan033 한정. 시리즈 50+ 글 또는 `(series, series_order)` 정렬 hotspot 등장 시 복합 인덱스 / 캐시 / 별도 테이블 재검토.
