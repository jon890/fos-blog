## ADR-011. catch-all OG 이미지 — API Route 우회

**Context**: Next.js metadata file `opengraph-image.tsx` 는 폴더 뒤에 `/opengraph-image` 세그먼트를 자동 부여. catch-all (`[...x]`) 내부에 두면 빌드 실패: `Catch-all must be the last part of the URL`.

**Decision**: catch-all 경로는 **API Route** 로 OG 이미지 생성, `generateMetadata` 가 `openGraph.images` 에 URL 직접 주입.

- catch-all: `src/app/api/og/posts/[...slug]/route.tsx`, `src/app/api/og/category/[...path]/route.tsx`
- 단일 dynamic: 기존 `opengraph-image.tsx` 컨벤션 유지 (홈, categories)

**Why**: Next.js 라우터 구조적 제약 — 우회 불가. 크롤러는 `<meta og:image>` URL 만 따라가므로 결과 동일. `revalidate = 60` 만 두면 자동 `Cache-Control` 부여 → metadata file 과 동등 ISR. 모든 경로 통일(자동 ISR 포기)/라우터 리팩토링(범위 초과)/정적 fallback 만(CTR 손해) 기각. 공용 `src/lib/og.ts` 로 metadata file/API Route 가 렌더 로직 공유.
