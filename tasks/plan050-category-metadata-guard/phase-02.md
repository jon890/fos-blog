# Phase 02 — 검증 + index.json 마킹 + production 모드 응답 확인

**Model**: haiku

## 작업 항목

### 1. 통합 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

### 2. production 모드 응답 확인 (선택)

dev server 의 ISR 동작이 production 과 다를 수 있어, 가능하면 production 모드에서 검증.

```bash
# cwd: /Users/nhn/personal/fos-blog
# 기존 dev server 끄고
pkill -f "next dev" 2>&1 || true
pnpm build > /tmp/fos-blog-build.log 2>&1 && \
  pnpm start > /tmp/fos-blog-start.log 2>&1 &
until grep -q "Ready" /tmp/fos-blog-start.log; do sleep 1; done

# 잘못된 path 응답
curl -sI "http://localhost:3000/category/%EB%B6%84%EC%82%B0_%EA%B3%84%EC%82%B0_%EC%95%8C%EA%B3%A0%EB%A6%AC%EC%A6%98.md" | head -3
# 기대: HTTP/1.1 404 (notFound() 가 production 에서도 정상 작동)

curl -s "http://localhost:3000/category/%EB%B6%84%EC%82%B0_%EA%B3%84%EC%82%B0_%EC%95%8C%EA%B3%A0%EB%A6%AC%EC%A6%98.md" | grep -oE '<(meta name="robots"|link rel="canonical")[^>]*>'
# 기대: <meta name="robots" content="noindex,nofollow">
#       (canonical 없어야 함)

# 정상 카테고리 회귀 없는지
curl -s "http://localhost:3000/category/devops" | grep -oE '<link rel="canonical"[^>]*>'
# 기대: canonical 정상

pkill -f "next start" 2>&1 || true
```

production build 가 시간 걸리고 (`pnpm build` 1-2분), 본 plan 의 핵심은 코드 변경이라 phase-01 의 dev server verification 만으로도 1차 통과. 본 단계는 deploy 전 추가 안전망.

### 3. Search Console 재인덱싱 안내 (사용자 메모)

production 배포 + ISR 갱신 (1분~) 후:

- `/api/og/category/분산_계산_알고리즘.md` 알람이 자연 해소 (Google 재크롤 시 metadata 가 noindex 응답)
- 가속 원하면 Search Console 에서 해당 URL "URL 검사" → "수정 확인" 클릭

### 4. index.json status 마킹

`tasks/plan050-category-metadata-guard/index.json`:

- 최상위 `status`: `"in_progress"` → `"completed"`
- `phases[0..1].status`: 각각 `"pending"` → `"completed"`

### 5. verification

```bash
# cwd: /Users/nhn/personal/fos-blog
grep -c "\"completed\"" tasks/plan050-category-metadata-guard/index.json
# 기대: 3 (top + phase 1/2)

grep -n "plan050" docs/code-architecture.md
# 기대: 1건 (SEO 정책 섹션 내)
```

## Out of Scope

- 기존 prerender 캐시 무효화 — production 배포 + ISR 60s 후 자연 해소
- posts/[...slug] 의 metadata fallback 강화 — 별 plan 후보
- Search Console URL 재인덱싱 요청 — 수동 UI
