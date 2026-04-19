# Phase 05 — 페이지 2개 + 홈 CTA 반영 + 최종 검증

## 컨텍스트 (자기완결 프롬프트)

최종 사용자 접점 구현. `/posts/latest`, `/posts/popular` SSR 페이지 생성 + 홈 섹션 하단에 CTA 버튼 추가. 마지막으로 통합 검증 (lint/type-check/test/build).

## 먼저 읽을 문서

- `docs/pages/posts-latest.md`, `docs/pages/posts-popular.md`
- `docs/pages/home.md` — 변경된 Layout/Interactions
- `docs/adr.md` — ADR-005 (noindex)
- `src/app/AGENTS.md`

## 기존 코드 참조

- `src/app/page.tsx` — 홈페이지 (수정 대상). 섹션 패턴/revalidate/getRepositories 호출부
- `src/app/categories/page.tsx` — 리스트 페이지 metadata/SSR 패턴
- `src/app/posts/[...slug]/page.tsx` — metadata generation 패턴

## 작업 목록 (총 5개)

### 1. `/posts/latest` 페이지

파일: `src/app/posts/latest/page.tsx`

```ts
export const revalidate = 60;
export const metadata = {
  title: "최신 글 — FOS Study",
  description: "개발 공부 기록 블로그의 최신 글 목록입니다.",
  robots: { index: false, follow: true },
};

export default async function PostsLatestPage() {
  // 1. getRepositories()로 post, visit 가져옴
  // 2. const items = await post.getRecentPostsCursor({ limit: 10 });
  // 3. const visitCounts = await visit.getPostVisitCounts(items.map(i => i.path));
  // 4. merge → initialItems (PostData & { visitCount, updatedAt, id })
  //    단, client에 전달 시 updatedAt/id는 nextCursor 생성용으로만 쓰이고 PostItem에는 visitCount만 유지
  //    → 서버에서 nextCursor 문자열 먼저 만들어 넘김
  // 5. const initialNextCursor = items.length === 10
  //       ? `${items[9].updatedAt.toISOString()}:${items[9].id}`
  //       : null;
  // 6. <PostsInfiniteList mode="latest" initialItems={...} initialNextCursor={...} />
  // 7. DB 에러 시 logger.warn + 빈 initialItems
}
```

페이지 레이아웃:
- 상단 제목 "최신 글" + 부제 "업데이트 순"
- `<PostsInfiniteList mode="latest" ...>`
- `<BackToTopButton variant="floating" />` (페이지 하단 배치)

### 2. `/posts/popular` 페이지

파일: `src/app/posts/popular/page.tsx`

```ts
export const revalidate = 600; // 10분
export const metadata = {
  title: "인기 글 — FOS Study",
  description: "개발 공부 기록 블로그의 방문수 기준 인기 글 목록입니다.",
  robots: { index: false, follow: true },
};

export default async function PostsPopularPage() {
  // 1. const [pathRows, total] = await Promise.all([
  //      visit.getPopularPostPathsOffset({ limit: 10, offset: 0 }),
  //      visit.getPopularPostPathsTotal(),
  //    ]);
  // 2. const postDataList = await post.getPostsByPaths(pathRows.map(p => p.path));
  // 3. reorder by pathRows 순서 + visitCount merge
  // 4. initialHasMore = 10 < total;
  // 5. <PostsInfiniteList mode="popular" initialItems={...}
  //                       initialOffset={pathRows.length}
  //                       initialHasMore={initialHasMore} />
  // 6. DB 에러 시 logger.warn + 빈 initialItems
}
```

페이지 레이아웃:
- 상단 제목 "인기 글" + 🔥 Flame 아이콘 + 부제 "방문수 순"
- `<PostsInfiniteList mode="popular" ...>`
- `<BackToTopButton variant="floating" />`

### 3. 홈페이지 CTA 버튼 추가

파일: `src/app/page.tsx` 수정

현재 "인기 글 섹션" (파일 line 103-121 부근):
```tsx
<section className="mb-16">
  ...
  <div className="space-y-4">
    {popularPosts.map(...)}
  </div>
  {/* ← 여기 추가 */}
  <div className="mt-6 md:mt-8 flex justify-center">
    <SectionCTAButton href="/posts/popular" label="인기 글 더 보기" />
  </div>
</section>
```

"최근 글 섹션" (파일 line 124-145 부근)도 동일하게 `<SectionCTAButton href="/posts/latest" label="최신 글 더 보기" />` 추가.

CTA 버튼은 `recentPosts.length > 0` / `popularPosts.length > 0` 조건 하에서만 노출.

### 4. Next.js 16 App Router 경계 확인 (FE1 패턴)

- 새 page.tsx가 `infra/` 를 직접 import 하지 않고 `@/infra/db/repositories`의 `getRepositories()`를 경유하는지 확인 (기존 `src/app/page.tsx` 와 동일 패턴 — services 경유 안 해도 CLAUDE.md 규칙상 허용 범위)
- `"use client"` 페이지 파일에 박히지 않았는지 (server component 유지)

### 5. 최종 통합 검증

```bash
# cwd: <worktree root>

# lint / type-check / test / build 순서대로
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

빌드 시 `noindex` 메타가 각 페이지 HTML output에 반영됐는지 확인:
```bash
# 빌드 산출물에서 robots 메타 확인 (Next.js 16 standalone 빌드)
grep -r "noindex" .next/server/app/posts/ | head -5
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 페이지 파일 존재
test -f src/app/posts/latest/page.tsx
test -f src/app/posts/popular/page.tsx

# 2) revalidate 설정
grep -n "export const revalidate = 60" src/app/posts/latest/page.tsx
grep -n "export const revalidate = 600" src/app/posts/popular/page.tsx

# 3) noindex (ADR-005)
grep -nE "robots.*index:\s*false" src/app/posts/latest/page.tsx
grep -nE "robots.*index:\s*false" src/app/posts/popular/page.tsx

# 4) 홈 CTA 버튼 추가
grep -n "SectionCTAButton" src/app/page.tsx
grep -n "/posts/latest" src/app/page.tsx
grep -n "/posts/popular" src/app/page.tsx

# 5) PostsInfiniteList 호출 확인
grep -n 'PostsInfiniteList' src/app/posts/latest/page.tsx
grep -n 'PostsInfiniteList' src/app/posts/popular/page.tsx
grep -n 'mode="latest"' src/app/posts/latest/page.tsx
grep -n 'mode="popular"' src/app/posts/popular/page.tsx

# 6) 페이지에 "use client" 없음 (서버 컴포넌트 유지)
! grep -l '"use client"' src/app/posts/latest/page.tsx
! grep -l '"use client"' src/app/posts/popular/page.tsx

# 7) app/ 가 infra/ 직접 import 하지 않음 (경로 일관성) — getRepositories 경유
grep -n "getRepositories" src/app/posts/latest/page.tsx
grep -n "getRepositories" src/app/posts/popular/page.tsx

# 8) 최종 통합 검증 통과
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 9) dev server boot + API endpoint 200 응답 확인 (런타임 smoke test)
pnpm db:up > /dev/null
(pnpm dev > /tmp/fosblog-dev.log 2>&1 &) && DEV_PID=$!
# ready 대기 (max 60s)
for i in {1..60}; do
  curl -sf http://localhost:3000/api/posts/latest?limit=1 > /dev/null && break
  sleep 1
done
curl -sfo /tmp/latest.json -w "latest=%{http_code}\n" "http://localhost:3000/api/posts/latest?limit=5"
curl -sfo /tmp/popular.json -w "popular=%{http_code}\n" "http://localhost:3000/api/posts/popular?limit=5&offset=0"
jq -e '.items and has("nextCursor")' /tmp/latest.json
jq -e '.items and has("hasMore")'    /tmp/popular.json
# 페이지 SSR 200 확인
curl -sfo /dev/null -w "page-latest=%{http_code}\n"  http://localhost:3000/posts/latest
curl -sfo /dev/null -w "page-popular=%{http_code}\n" http://localhost:3000/posts/popular
kill $(pgrep -f "next dev" | head -1) 2>/dev/null || true

# 10) 변경 파일 실측
git diff --name-only  # 기대: 페이지 2개, page.tsx, 컴포넌트 4개, Repository 2개, API route 2개, 테스트 4개, 스키마 2개, drizzle sql 1개
git diff --stat       # 실측 파일/줄 수 기록 (critic이 수치 검증)
```

## PHASE_BLOCKED 조건

- `pnpm build` 가 Tailwind `@source` 누락으로 신규 클래스 제거 → **PHASE_BLOCKED: globals.css 의 @source 규칙 수동 확인 필요**
- Next.js 16 standalone 빌드 산출물에 `noindex` 메타 미반영 → **PHASE_BLOCKED: Next.js 16 metadata API 호환성 검증 필요**
- `pnpm test --run` 에서 기존 테스트(무관) 실패 → **PHASE_BLOCKED: 기존 회귀 원인 분석 필요 — 본 plan과 분리**

## 완료 후 team-lead 처리

- 모든 phase PASS 후 team-lead가 통합 검증 명령 재확인 (`pnpm lint && pnpm type-check && pnpm test --run && pnpm build`)
- **분리 커밋 필수** (atomic commits — 사용자 선호 메모리 [atomic-commits]). 단일 커밋 금지:
  - `feat(db): add sort indexes for latest/popular lists`
  - `feat(posts): add cursor/offset list repository methods + tests`
  - `feat(api): add /api/posts/latest and /api/posts/popular + tests`
  - `feat(ui): add infinite scroll components`
  - `feat(posts): add /posts/latest /posts/popular pages + home CTA`
- docs는 이미 별도 선행 커밋됨 — 이 plan 실행 중 docs 변경 금지
- PR 제목: `feat(posts): add infinite scroll latest/popular pages`
- index.json `status: "completed"` 갱신 커밋 + push (누락 시 재실행 사고)

## 커밋 제외 (phase 내부)

executor는 phase 내부에서 커밋하지 않는다. team-lead가 일괄 처리.
