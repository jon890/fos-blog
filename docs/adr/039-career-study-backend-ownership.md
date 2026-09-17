# ADR-039: 학습자료 저장 소유권을 career-os Backend로 옮긴다

- **status**: `accepted`
- **결정**: 학습자료 수집, 개인 상태, 추천과 게시 이력의 데이터 소유자는 career-os의 HTTP Backend다.
  fos-blog는 관리자 화면과 Better Auth를 유지하고, 로컬 MySQL과 `/api/study/v1` 대신
  서버 전용 client로 그 Backend를 호출한다.
- **인증**: 인증만 브라우저 세션 대신 역할이 구분된 서버용 Bearer로 바꾼다.
  `producer`는 수집과 추천 쓰기만 수행하고 개인 상태 수정과 가져오기 확정은 거절한다.
  `admin-gateway`는 fos-blog Server Action에서만 사용하고 수집과 추천 생성은 거절한다.
  두 token은 서로 다른 값이며 fos-blog 서버에는 `admin-gateway` token만 둔다.
  브라우저는 Backend를 직접 호출하지 않고 token을 HTML, RSC payload, JavaScript bundle과 로그에서 볼 수 없다.
- **계약**: 기본 경로, DTO, 상태 코드, 멱등 키, URL 정규화와 cursor 형식은 바꾸지 않는다.
  계약을 바꾸면서 저장소를 옮기면 실패 원인이 둘로 늘어나기 때문이다.
- **전환 방식**: dual-write를 쓰지 않고 단일 writer를 한 번에 바꾼다.
  career-os의 수집·추천 실행과 fos-blog 관리자 쓰기를 중지한 뒤 호출 주소를 바꾸고 쓰기를 재개한다.
  cutover 직전 사전 점검이 옮길 데이터와 기존 endpoint 사용 내역이 있는지 판정하고,
  그 판정이 snapshot 이관, 행 검증과 관찰 기간의 적용 여부를 정한다.
- **migration**: 기존 `drizzle/0012_tired_luminals.sql`과 `drizzle/meta/0012_snapshot.json`은
  적용 여부와 무관하게 이력으로 보존한다.
  제거는 현재 schema에서 새 forward migration을 생성하는 방식으로 처리하며 과거 migration을 편집하지 않는다.
  외래 키가 모두 `RESTRICT`라서 생성 도구의 이름 순서 대신 자식 테이블부터 지우는 순서를 명시한다.
- **맥락**: 수집과 추천을 실행하는 쪽은 career-os인데 저장과 HTTP 계약은 fos-blog가 가지고 있었다.
  한 기능의 실행과 저장이 두 저장소에 나뉘어 있어 스키마를 바꿀 때마다 양쪽 배포 순서를 맞춰야 했다.
- **대안 기각**:
  - dual-write는 양쪽에 동시에 쓴 결과를 합치는 비용이 크고 불일치를 만든다.
  - 저장소를 옮기면서 DTO와 cursor 형식을 함께 바꾸면 실패 원인을 계약과 이전 중 하나로 좁힐 수 없다.
  - 브라우저가 Backend를 직접 호출하면 관리자 token을 브라우저에 두어야 한다.
  - 과거 migration을 편집해 study 테이블 생성을 없애면 이미 적용한 환경의 이력과 어긋난다.
- **결과**:
  - 얻는 것: 수집·추천의 실행과 저장이 한 저장소에 모인다.
    fos-blog는 관리자 화면, Better Auth와 공개 블로그만 책임진다.
  - 감당할 것: 관리자 화면이 외부 HTTP 장애에 노출되므로 timeout, 오류 code 전달과
    응답 검증을 fos-blog가 직접 다뤄야 한다.
    fos-blog에 study 테이블이 없어진 뒤에는 주소 전환만으로 되돌릴 수 없고 DB backup 복구가 필요하다.

모듈 배치는 [학습자료 모듈](../code-architecture.md#학습자료-모듈),
호출 흐름과 실패 분기는 [학습자료 관리 흐름](../flow.md#학습자료-관리-흐름),
역할별 권한과 소비 호환 조건은 [학습자료 HTTP 계약](../api/study-library.md)에 둔다.
ADR-037의 저장 위치 결정과 ADR-038의 트랜잭션 계약을 이 결정이 대체한다.
