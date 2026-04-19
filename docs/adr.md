# ADR — 기술 결정 기록

**작성일:** 2026-04-19

이 문서는 **코드/설정/git log로 자명하지 않은 기술 결정**만 기록한다. 자명한 사항(파일 위치, 함수명, 단순 구현 선택)은 제외.

---

## ADR-001. 무한 스크롤 페이지 도입 — SSR 첫 페이지 + 클라이언트 추가 로드 (하이브리드)

**Context**: 홈페이지 인기/최신 글이 6개씩만 노출되어 전체 200개 글 탐색 경로가 없음.

**Decision**: `/posts/latest`, `/posts/popular` 2개 전용 페이지를 만들고, 첫 10개는 **SSR로 렌더**, 이후는 클라이언트에서 `fetch` 기반 무한 스크롤로 로드한다.

**Alternatives Considered**:
- **통합 페이지 `/posts?tab=...`**: URL 1개로 탭 전환. 그러나 SSR 시 두 쿼리 모두 준비해야 하고, 탭별 상태 관리가 복잡.
- **Full Client-side Rendering**: 전체 리스트를 JS로 로드. SEO 손해 + FCP 느려짐.
- **페이지네이션(`?page=N`)**: 사용자가 명시적으로 페이지 이동. 무한 스크롤 대비 UX 대비 체감 느림 — 사용자 요구와 맞지 않음.

**Consequences**:
- 첫 페이지 SEO 무난 (단 페이지 자체는 `noindex` — ADR-005)
- 초기 응답 빠름, 스크롤 중 추가 데이터 끊김 없음
- 뒤로가기 시 React state가 초기화되어 **로드된 목록이 리셋**됨. Q14 결정에 따라 단순 유지, 추후 sessionStorage 복원 여지 남김

**Follow-ups**:
- 사용자가 뒤로가기 UX 불만 제기 시 sessionStorage 기반 상태 복원 추가

---

## ADR-002. 페이지네이션 방식 — 최신=Cursor, 인기=Offset (혼합)

**Context**: 무한 스크롤은 페이징 안정성이 핵심. 중간에 글이 추가/변동되어도 **중복/누락이 없어야** 함.

**Decision**:
- **최신글**: **Cursor 기반** composite key `(updatedAt, id)`
  ```
  WHERE (updated_at, id) < (:cursorUpdated, :cursorId)
  ORDER BY updated_at DESC, id DESC
  ```
- **인기글**: **Offset 기반** + 2차 정렬 키 `pagePath`
  ```
  ORDER BY visit_count DESC, page_path ASC LIMIT :n OFFSET :o
  ```

**Drivers**:
- 최신글은 `updatedAt` 동점 가능성 존재(동시 sync 배치) → cursor로만 페이징 시 누락 방지 위해 `id` 를 secondary key로 포함
- 인기글은 `visitCount` 정수 동점이 흔함 → `page_path` 2차 정렬로 안정화. Cursor 구현 시 (visit_count, page_path) 복합 비교가 복잡하고 인기 순위 변동이 느려 offset 중복 위험 낮음

**Alternatives**:
- **둘 다 offset**: 단순. 그러나 최신글은 sync 배치 동안 새 글 추가되면 경계에서 중복이 실제로 발생 (updatedAt 기준 시간이 최근인 글이 앞으로 밀림) → 기각
- **둘 다 cursor**: 이상적이지만 인기글은 합성 커서 비교 SQL이 복잡 + 성능/가독성 손해 → 기각

**Consequences**:
- 인덱스 2개 추가 필요 ([data-schema.md](./data-schema.md))
- API 응답 shape이 모드별로 다름 (`nextCursor` vs `hasMore`) — client 컴포넌트가 분기 처리

---

## ADR-003. 홈 진입 UX — 섹션 하단 CTA 버튼 (카테고리 섹션의 "모두 보기 →" 링크 패턴과 의도적 차별화)

**Context**: 홈의 카테고리 섹션은 이미 헤더 우측에 **"모두 보기 →"** 텍스트 링크를 쓴다. 인기/최신 섹션도 같은 패턴으로 통일할 수 있음.

**Decision**: 인기/최신 섹션에는 **섹션 하단 큰 CTA 버튼**을 둔다. 카테고리 섹션 패턴과 다르게 간다.

**Drivers**:
- 사용자 요청(Q16 B안): "버튼으로 한번 시도해보자"
- 카테고리는 보조 네비게이션, 글 목록은 **핵심 탐색 행동** — 더 강한 클릭 유도가 필요
- 헤더 우측 링크 패턴은 모바일 터치 타깃이 작음 (44px 미만 위험)

**Alternatives**:
- **헤더 우측 "모두 보기 →" (일관성 A안)**: 기각. 핵심 탐색 행동에는 약함.

**Consequences**:
- 홈 페이지에 두 종류 진입 패턴 공존 (카테고리=링크 / 글=버튼). 사용자 A/B 판단 후 통일 여지.

**Follow-ups**:
- 분석 지표(카테고리 "모두 보기" 클릭률 vs 글 CTA 버튼 클릭률) 비교 검토 → 추후 통일 결정

---

## ADR-004. 데이터 Fetching — API Route (Server Action / Server Components 검토 후 기각)

**Context**: 무한 스크롤의 추가 로드 API 구현 수단.

**Decision**: **API Route** (`app/api/posts/latest/route.ts`, `.../popular/route.ts`)

**Alternatives**:
- **Server Action**: 타입 안전·직렬화 자동이지만 GET 지원 안 됨 (POST만) → 브라우저/CDN 캐시 미활용 + 무한 스크롤 의미론과 어긋남
- **Server Components with `searchParams`**: URL이 갱신되며 서버에서 새 페이지 렌더. 무한 스크롤에는 맞지 않고(전체 리렌더) Q8(URL 상태 미반영) 결정과 충돌

**Consequences**:
- 표준 HTTP GET — 브라우저 devtools에서 디버깅 용이
- JSON 직렬화 경계 명시 (`Date → ISO string` 변환을 cursor 파싱 시 처리)

---

## ADR-005. SEO — 리스트 페이지 `noindex`

**Context**: 리스트 페이지는 검색엔진 기준 가치가 낮고 중복 콘텐츠 가능성이 있음 (각 글의 제목이 이미 홈/카테고리에 노출).

**Decision**: `/posts/latest`, `/posts/popular` 모두 `export const metadata = { robots: { index: false, follow: true } }`.

**Drivers**:
- 사용자 요청(직접 결정)
- 검색엔진은 개별 글 페이지(`/posts/<path>`)를 색인하도록 유도 — 리스트가 검색결과에 끼어들어 CTR을 희석하는 것 방지
- `follow: true`는 유지 — 크롤러가 리스트를 통해 개별 글까지 도달 가능

**Consequences**:
- Search Console에 "색인 생성 제외" 표시되는데 이는 의도된 동작
- 개별 글 페이지의 검색 노출에 영향 없음

---

## ADR-006. 라이브러리 — IntersectionObserver 직접 구현 (의존성 미도입)

**Context**: 무한 스크롤 트리거 구현 방법.

**Decision**: **IntersectionObserver 네이티브 API 직접 사용**. `react-intersection-observer` 같은 래퍼 미도입.

**Drivers**:
- 번들 크기 증가 0
- 10줄 내외 구현으로 충분
- 프로젝트 정책(CLAUDE.md): MVP 필요 의존성만

**Alternatives**:
- `react-intersection-observer` (~2KB gzip) — 기각. 얻는 것 대비 과함.

**Consequences**:
- 컴포넌트 내부에서 `useEffect` + `IntersectionObserver` 훅 패턴 직접 관리
- 리렌더 최적화는 `useRef`로 observer 인스턴스 고정
