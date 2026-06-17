## ADR-028. 시리즈 인덱스 카드는 별도 SeriesCard 컴포넌트 (plan047)

- **결정**: 시리즈 인덱스 (`/series`) 와 메인 페이지 시리즈 섹션에서 사용할 카드는 `PostCard` 의 variant 가 아닌 신규 `SeriesCard` 컴포넌트로 분리한다. 도메인 필드 — 시리즈명, postCount, latestUpdatedAt, 대표 카테고리, 첫 글 description — 만 props 로 받는다.
- **맥락**: 시리즈는 "글 모음" 도메인으로 글 자체와 메타데이터 의미가 다르다. PostCard 의 `createdAt` / 단일 `category` / `viewCount` / `index` 와 시리즈의 `postCount` / `latestUpdatedAt` / `대표 카테고리` 는 명세가 충돌한다.
- **대안 기각**:
  - **PostCard 에 `variant="series"` 추가** 기각 — 같은 컴포넌트에 두 도메인 데이터 분기가 섞이면 props 타입 union 이 커지고 (`PostData | SeriesInfo`) 내부 if-else 폭증. plan047 이후 시리즈 카드 메타 (예: "마지막 업데이트", "총 N편") 추가 시 글 카드와 무관한 분기 계속 증식.
  - **PostCard 의 grid variant 를 그대로 재사용 + 카드 안에서 textContent 만 시리즈 정보로 치환** 기각 — `PostData` 타입에 시리즈 도메인 필드가 없어 억지로 매핑하면 의미 오염 (예: `title=시리즈명`, `description=첫 글 description`).
- **트레이드오프**:
  - 디자인 시각 언어는 PostCard grid variant 와 의도적으로 일치시킨다 — 카드 border / hover / 카테고리 chip / typography 토큰 동일. "별 컴포넌트 = 별 디자인" 이 아니라 "별 도메인 = 별 컴포넌트" 가 결정 기준.
