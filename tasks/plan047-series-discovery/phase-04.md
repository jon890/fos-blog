# Phase 04 — 검증 + index.json completed 마킹

**Model**: haiku
**Goal**: 빌드/타입/린트/테스트 통과 확인 + dev server 시각 검증 + index.json 의 phase 1/2/3/4 와 최상위 status 를 모두 `"completed"` 로 마킹.

## 작업 항목

### 1. 자동 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

모두 통과해야 함. 실패 시 phase 1/2/3 에 회귀 — fix 후 재실행.

### 2. dev server 시각 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm dev > /tmp/fos-blog-dev.log 2>&1 &
until grep -q "Ready in" /tmp/fos-blog-dev.log; do sleep 0.5; done
```

cmux browser (가능 시) 또는 playwright 로:

1. `http://localhost:3000/series` — 시리즈 인덱스 카드 grid 정상 렌더
2. `http://localhost:3000/` — Popular Posts 다음에 "시리즈" 섹션 + "시리즈 더 보기" CTA
3. Header — "03 / 시리즈" 항목 표시 및 클릭 시 `/series` 이동
4. SeriesCard 클릭 → `/series/<name>` 이동

시리즈 0건인 로컬 DB 라면 sync 1회 실행으로 데이터 확보:

```bash
# cwd: /Users/nhn/personal/fos-blog
SYNC_API_KEY=$(grep "^SYNC_API_KEY=" .env | cut -d= -f2-)
curl -s -X POST http://localhost:3000/api/sync -H "Authorization: Bearer $SYNC_API_KEY" -m 240 > /dev/null
```

### 3. index.json status 마킹

`tasks/plan047-series-discovery/index.json`:

- 최상위 `status`: `"in_progress"` → `"completed"`
- `phases[0].status` (phase 1): `"pending"` → `"completed"`
- `phases[1].status` (phase 2): `"pending"` → `"completed"`
- `phases[2].status` (phase 3): `"pending"` → `"completed"`
- `phases[3].status` (phase 4): `"pending"` → `"completed"`

### 4. verification

```bash
# cwd: /Users/nhn/personal/fos-blog
# completed 토큰 5개 — top status + phase 1/2/3/4
grep -c "\"completed\"" tasks/plan047-series-discovery/index.json
# 기대: 5

# docs 갱신 완료 확인 (plan047 마커가 모두 박혀 있는지)
grep -n "plan047" docs/code-architecture.md docs/flow.md docs/pages/home.md docs/pages/series-index.md docs/adr.md
# 기대: 각 파일에서 plan047 마커 1건 이상
```

## Out of Scope

- 추가 기능 (예: 시리즈별 viewCount 합산, 시리즈 RSS 피드) — 별 plan
- `og:image` 동적 생성 — 별 plan
