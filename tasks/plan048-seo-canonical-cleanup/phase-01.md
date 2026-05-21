# Phase 01 — category 페이지 글 카드 href 인코딩 통일

**Model**: sonnet
**Goal**: `src/app/category/[...path]/page.tsx:191` 의 `encodeURIComponent(p.path)` 를 segment-encoding 패턴으로 변경. 다른 7곳과 동일하게 슬래시 보존.

## Context (자기완결)

Google Search Console 의 "적절한 표준 태그가 포함된 대체 페이지" 알람 분석 결과, 카테고리 페이지 글 카드의 `href` 만 슬래시까지 `%2F` 로 통째 인코딩되고 있음.

영향:

- 카테고리 페이지 → 글 카드 클릭 시 `/posts/devops%2Fdocker%2Fdocker.md` 로 이동
- Next.js 가 200 응답 (slug 디코딩 후 정상 처리)
- canonical 메타는 정상 슬래시 URL 가리킴 → Google 이 `%2F` URL 을 alternate 로 분류
- 한글 URL (`김영한의-실전-데이터베이스-설계`) 도 같은 경로로 잘못 인코딩 발생

다른 7곳은 모두 segment-encoding 패턴 (정찰 결과):

- `src/components/PostCard.tsx` `postHref`
- `src/components/SearchDialog.tsx`
- `src/components/ArticleFooter.tsx` (series prev/next 2곳)
- `src/app/posts/[...slug]/page.tsx` (canonical + OG image)
- `src/app/sitemap.ts`

## 작업 항목

### 1. line 191 수정

`src/app/category/[...path]/page.tsx`:

```diff
-                  href={`/posts/${encodeURIComponent(p.path)}`}
+                  href={`/posts/${p.path.split("/").map(encodeURIComponent).join("/")}`}
```

### 2. 같은 파일 내 다른 인코딩 위치 회귀 점검

이미 정찰 완료 — line 38, 53, 103, 116, 162 는 모두 `.map(encodeURIComponent)` 패턴 정상. line 191 만 단일 인코딩이라 동일 패턴으로 일치.

다만 phase 실행 시 한 번 더 grep 으로 회귀 없는지 확인:

```bash
# cwd: /Users/nhn/personal/fos-blog
grep -nE "encodeURIComponent\([^)]*\.path\)" src/app/category/\[...path\]/page.tsx
# 기대: 0건 (수정 후)
```

### 3. 자동 verification

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm lint
pnpm type-check

# 수정 확인
grep -n "split.*encodeURIComponent.*join" src/app/category/\[...path\]/page.tsx
# 기대: line 162 (folder nav) + line 191 (수정된 글 href) = 2건
```

### 4. dev server 시각 확인 (선택)

```bash
# cwd: /Users/nhn/personal/fos-blog
# (dev server 가 이미 실행 중이면 hot-reload)
# 카테고리 페이지에서 글 카드 href 확인
curl -s http://localhost:3000/category/devops/docker | grep -oE 'href="/posts/[^"]+"' | head -3
# 기대: href="/posts/devops/docker/docker.md" 형태 (슬래시 보존)
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/app/category/[...path]/page.tsx` | 수정 (line 191 한 줄) |

## Out of Scope

- frontmatter index:false 인프라 → phase 02
- 검증 + Search Console 재인덱싱 안내 → phase 03
- README prerender 캐시 해소 — production deploy 사이클로 자연 회복 예상. 별 plan 후보
- 한글 URL 의 추가 인코딩 처리 — 본 수정으로 자동 회복 (사용자 경로 동일)

## Risks

| 리스크 | 완화 |
|---|---|
| 다른 곳에서 단일 인코딩 패턴이 의도된 곳이 있을 가능성 | 정찰 결과 카테고리 page 외 모든 곳이 segment-encoding. 단일 인코딩은 단일 segment slug (예: `cat.slug`) 한정 — `p.path` 같은 다중 segment 에는 부적합 |
| 카테고리 페이지 SSR 리렌더 시 ISR 캐시가 옛 href 잔존 | revalidate=300 (5분) 으로 자연 갱신. 강제 갱신 필요 시 deploy 사이클 |
| Google 의 alternate 분류 잔존 | 코드 수정만으론 즉시 해소 안 됨. Search Console 에서 URL 재검사 요청이 phase-03 의 권장 후속 |
