# Phase 01 — robots.ts /api/og/ allow 예외 추가

**Model**: sonnet
**Goal**: `src/app/robots.ts` 의 disallow 정책이 OG 이미지 endpoint 도 막고 있어 Google 크롤러가 og:image fetch 시도 시 robots 차단 알람을 띄움. `/api/og/` 만 allow 예외 처리.

## Context (자기완결)

`src/app/robots.ts` 현재:

```ts
rules: [
  {
    userAgent: "*",
    allow: "/",
    disallow: ["/api/", "/_next/"],
  },
],
```

글 페이지 (`src/app/posts/[...slug]/page.tsx:59`) 와 카테고리 페이지 (`src/app/category/[...path]/page.tsx:53`) 의 og:image 메타가 `${siteUrl}/api/og/posts/...` / `${siteUrl}/api/og/category/...` 를 가리킴.
Google 크롤러가 og:image fetch 시도 → robots.txt 가 차단 → Search Console 알람 9건.

**의도 (사용자 확인 2026-05-21)**:

- OG 이미지의 Google Image Search 노출은 OK — 트래픽 + 효과
- 다른 `/api/*` 는 차단 유지 — 인덱싱 가치 없음

Google robots.txt 매칭은 가장 구체적인 (긴) 경로 우선이라 allow 와 disallow 가 공존해도 의도대로 작동.

## 작업 항목

### 1. `src/app/robots.ts` 수정

```diff
 export default function robots(): MetadataRoute.Robots {
   const baseUrl = env.NEXT_PUBLIC_SITE_URL;

   return {
     rules: [
       {
         userAgent: "*",
-        allow: "/",
+        allow: ["/", "/api/og/"],
         disallow: ["/api/", "/_next/"],
       },
     ],
     sitemap: `${baseUrl}/sitemap.xml`,
   };
 }
```

`MetadataRoute.Robots` 의 `allow` 는 `string | string[]` 둘 다 지원 — type 변경 정상.

### 2. 자동 verification

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 변경 확인
grep -n "api/og" src/app/robots.ts
# 기대: 1건 (allow 배열 안)
```

### 3. dev server 시각 확인

```bash
# cwd: /Users/nhn/personal/fos-blog
# (dev server 가 실행 중이면 hot-reload)
curl -s http://localhost:3000/robots.txt
# 기대 출력 (예):
#   User-Agent: *
#   Allow: /
#   Allow: /api/og/
#   Disallow: /api/
#   Disallow: /_next/
#   Sitemap: ...
```

`Allow: /api/og/` 라인 존재 + `Disallow: /api/` 라인도 함께 존재해야 정상.

### 4. robots 매칭 규칙 검증 (선택)

[Google robots.txt 테스터](https://search.google.com/search-console) 에서 본 plan 머지 후 production 배포 시 확인.

로컬에서는 grep 으로 충분 — 매칭 우선순위 (longest match) 는 Google 측 동작이라 코드 검증 어려움.

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/app/robots.ts` | 수정 (allow 1 줄) |

## Out of Scope

- `/api/og/category/분산_계산_알고리즘.md` 같은 `.md` slug 데이터 이상 → plan050 후보 (PostSyncService.parsePath 의 root-level 파일 처리)
- OG 이미지의 `X-Robots-Tag: noindex` 응답 헤더 — 사용자 결정상 OG 색인 노출 OK, 본 phase 에서 미적용
- Google Search Console 의 다른 알람 카테고리 (noindex / 리디렉션 / 발견됨-색인 안 됨 등) — 사용자 추가 공유 후 별 plan 후보

## Risks

| 리스크 | 완화 |
|---|---|
| `allow: ["/", "/api/og/"]` 타입 호환성 | Next.js `MetadataRoute.Robots.rules[].allow` 는 `string \| string[]` 지원 (선언 type). type-check 단계에서 검증 |
| 매칭 우선순위 (longest match) 가 의도와 다름 | Google / Bing 모두 longest-match 표준. `/api/og/foo` (10 chars) vs `/api/` (5 chars) → allow 우선. 검증은 production 배포 후 Google robots.txt 테스터 |
| 봇 트래픽 증가로 OG image 동적 생성 부하 | OG route 는 이미 ISR 로 캐싱 (Next.js App Router 기본). 첫 fetch 후 캐시 hit. 부하 영향 미미 |
| robots.ts 가 정적 빌드 (revalidate 없음) | Next.js App Router 의 `robots.ts` 는 빌드 시점 정적 생성. 변경 후 production 빌드 + 배포 사이클 필요. 본 phase 는 코드 변경만, 배포는 별 단계 |
