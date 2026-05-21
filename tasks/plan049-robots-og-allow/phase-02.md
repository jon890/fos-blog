# Phase 02 — 검증 + index.json 마킹 + Search Console 안내

**Model**: haiku

## 작업 항목

### 1. 통합 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# robots.txt 출력 정합
curl -s http://localhost:3000/robots.txt | grep -E "Allow|Disallow"
# 기대:
#   Allow: /
#   Allow: /api/og/
#   Disallow: /api/
#   Disallow: /_next/
```

### 2. Search Console 재인덱싱 안내 (사용자 메모)

production 배포 후 사용자가 Search Console 에서 수행:

1. `robots.txt에 의해 차단됨` 알람 페이지에서 "수정 확인" / "재크롤 요청"
2. Google robots.txt 캐시 (대략 24시간) 갱신 대기
3. 알람 9건 자연 해소 관찰 — 즉시 사라지지 않음

이 단계는 수동 UI 작업.

### 3. index.json status 마킹

`tasks/plan049-robots-og-allow/index.json`:

- 최상위 `status`: `"in_progress"` → `"completed"`
- `phases[0..1].status`: 각각 `"pending"` → `"completed"`

### 4. verification

```bash
# cwd: /Users/nhn/personal/fos-blog
# completed 토큰 3개 — top + phase 1/2
grep -c "\"completed\"" tasks/plan049-robots-og-allow/index.json
# 기대: 3

# docs 갱신 확인
grep -n "plan049" docs/code-architecture.md
# 기대: SEO 색인 정책 섹션 내 1건
```

## Out of Scope

- `.md` slug 데이터 이상 (parsePath root-level 처리) → plan050 후보
- 다른 SEO 알람 카테고리 → 사용자 GSC 확인 결과에 따라 별 plan
