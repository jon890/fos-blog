# Phase 03 — 검증 + Search Console 안내 + index.json 마킹

**Model**: haiku

## 작업 항목

### 1. 자동 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

### 2. dev server 시각 확인

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm dev > /tmp/fos-blog-dev.log 2>&1 &
until grep -q "Ready in" /tmp/fos-blog-dev.log; do sleep 0.5; done
```

확인 항목:

- 카테고리 페이지 (`/category/devops/docker` 등) 의 글 카드 href 가 슬래시 보존 형태인지 — `curl -s http://localhost:3000/category/devops/docker | grep -oE 'href="/posts/[^"]+"' | head -3`
- 글 페이지 (`/posts/.../...`) 의 canonical 메타가 정상 슬래시 URL 인지
- (선택) frontmatter `index: false` 를 갖는 테스트 마크다운 임시 생성 시 `<meta name="robots" content="noindex,follow">` 출력 확인

### 3. Search Console 재인덱싱 안내 (사용자용 메모)

phase-01 수정 후 production 배포가 완료되면, 사용자가 Search Console 에서 다음 작업을 수행한다:

1. 알람 리스트의 `%2F` URL 을 클릭 → "URL 검사" → 색인 요청은 **하지 않는다** (이 URL 들은 사라져야 함)
2. 정상 슬래시 URL (예: `/posts/devops/docker/docker.md`) 을 "URL 검사" → "색인 요청" 클릭
3. 한글 URL 도 정상 슬래시로 재검사
4. README URL 들은 별도 plan 후보 — phase-03 결과 보고에서 잔존 시 사용자에게 언급

이 단계는 GitHub Actions / 자동화 불가. 수동 작업.

### 4. index.json status 마킹

`tasks/plan048-seo-canonical-cleanup/index.json`:

- 최상위 `status`: `"in_progress"` → `"completed"`
- `phases[0..2].status`: 각각 `"pending"` → `"completed"`

### 5. verification

```bash
# cwd: /Users/nhn/personal/fos-blog
# completed 토큰 4개 — top + phase 1/2/3
grep -c "\"completed\"" tasks/plan048-seo-canonical-cleanup/index.json
# 기대: 4

# docs 갱신 확인
grep -n "plan048" docs/code-architecture.md
# 기대: SEO 색인 정책 섹션 1건 이상
```

## Out of Scope

- README prerender 캐시 해소 (다음 production deploy 사이클로 자연 회복 관찰)
- Search Console 재인덱싱 자동화 (수동 UI 작업)
- frontmatter index 의 실제 적용 글 — 본 plan 은 인프라만
