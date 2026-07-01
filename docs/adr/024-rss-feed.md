## ADR-024. RSS feed — RSS 2.0 + `pubDate=createdAt` + 50 limit (plan027)

**Context**: issue #88 — `/rss.xml` 라우트 신설. RSS reader 가 글 발행을 추적할 수 있게. 형식 / 정렬 / 한도 세 결정이 코드/git log 로 자명하지 않음.

**Decision**:

1. **RSS 2.0** (Atom 1.0 기각) — channel/item 구조 + `<atom:link rel="self">` 만 추가해 reader 호환성 최대화.
2. **`<pubDate>` = `createdAt` (`updatedAt` 아님)** — sync 가 동일 글을 재처리하면 `updatedAt` 이 갱신됨. `pubDate` 가 그걸 따라가면 RSS reader 가 기존 글을 "새 글" 로 오인해 unread 표시 → 사용자 노이즈. `createdAt` 은 첫 sync 시점 고정이라 안전.
3. **`limit = 50`** — RSS reader 의 일반적 캐시 윈도우 (수 일~수 주 누락) 대비 충분. 글 발행 주기 평균 1일 1건 가정 시 50일 보장. 100+ 로 늘리면 채널 XML 크기 증가 + reader fetch 비용 증가. 향후 발행 빈도 변화 시 재검토.

**Why (대안 기각)**:

- **Atom 1.0** 기각: feature 차이는 거의 없고 RSS 2.0 reader 호환성이 더 넓음. atom:link self 만 채택해 양쪽 spec 의 강점 흡수.
- **`<content:encoded>` full HTML 본문 포함** 기각: feed 크기 증가 + 광고 없는 본문 노출이 트래픽 손실 우려. `<description>` 에 300자 summary (extractDescription) 만 노출.
- **`pubDate=updatedAt`** 기각: 위 #2 사유.
- **카테고리별 RSS (`/category/[name]/rss.xml`)** 기각: scope 큼 + 일반 RSS 가 카테고리 다양성 보존. 별도 plan 후보.

**Scope**: 본 ADR 결정은 plan027 한정. 글 수가 1년 100+ 도달 시 limit / pagination 재검토.
