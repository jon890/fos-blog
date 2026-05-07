# Phase 01 — /rss.xml 라우트 + RSS 2.0 XML

**Model**: sonnet
**Goal**: `/rss.xml` 라우트 신설 — 활성 글 최근 50개 RSS 2.0 피드. RSS reader 등록 가능하게 layout 의 head 에 link rel="alternate" 추가.

## Context (자기완결)

현재 `/sitemap.xml` 은 Next.js metadata API (`src/app/sitemap.ts`) 로 생성. RSS 는 동일 패턴으로 라우트 핸들러로 구현 가능.

**플젝 컨벤션**:
- App Router route handler — `src/app/rss.xml/route.ts` 또는 `src/app/feed/route.ts`
- `Content-Type: application/rss+xml; charset=utf-8`
- `revalidate = 600` (10분 캐시)
- `siteUrl = env.NEXT_PUBLIC_SITE_URL`

## 작업 항목

### 1. `src/app/rss.xml/route.ts` 신규

```ts
import { NextResponse } from "next/server";
import { getRepositories } from "@/infra/db/repositories";
import { extractDescription } from "@/lib/markdown";
import { env } from "@/env";
import logger from "@/lib/logger";

export const runtime = "nodejs";
export const revalidate = 600;

const log = logger.child({ module: "app/rss" });

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;
const SITE_TITLE = "FOS Study";
const SITE_DESCRIPTION = "한 명의 백엔드 엔지니어가 매일 쌓는 학습 노트";

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

export async function GET() {
  try {
    const { post } = getRepositories();
    const posts = await post.getRecentActive({ limit: 50 });

    const items = posts.map((p) => {
      const url = `${SITE_URL}/posts/${p.path.split("/").map(encodeURIComponent).join("/")}`;
      const desc = extractDescription(p.content ?? p.description ?? "", 300);
      const pubDate = (p.createdAt ?? new Date()).toUTCString();
      return `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(p.category)}</category>
      <description>${escapeXml(desc)}</description>
    </item>`;
    }).join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(SITE_URL)}/rss.xml" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    log.error({ err: e instanceof Error ? e : new Error(String(e)) }, "RSS render failed");
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
```

`extractDescription(p.content ?? p.description ?? "", 300)` — content 가 markdown 본문이라 plan #118 의 HTML strip + truncate 가 자동 적용 (PR #118 머지 후).

### 2. PostRepository.getRecentActive 보완

이미 존재하면 그대로 사용. 없으면 추가:

```ts
async getRecentActive({ limit = 50 }: { limit?: number } = {}): Promise<Post[]> {
  return this.db
    .select()
    .from(posts)
    .where(eq(posts.isActive, true))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
}
```

executor 가 grep 으로 기존 메서드 (`getRecent` / `getLatest` / `getActive` 등) 확인 후 재사용 또는 신규 결정.

### 3. `src/app/layout.tsx` 메타 link 추가

`<head>` 안에 (혹은 metadata.alternates 의 types):

```ts
export const metadata: Metadata = {
  // ...
  alternates: {
    canonical: ...,
    types: {
      "application/rss+xml": [{ url: "/rss.xml", title: "FOS Study RSS" }],
    },
  },
};
```

Next.js 가 자동으로 `<link rel="alternate" type="application/rss+xml" href="/rss.xml">` 생성.

### 4. `src/app/robots.ts` 업데이트 (선택)

robots.txt 에 RSS URL 명시:

```ts
return {
  rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/_next/"] }],
  sitemap: `${baseUrl}/sitemap.xml`,
};
```

`MetadataRoute.Robots` 는 RSS URL 별도 필드 없음 → 변경 불필요. RSS feed 는 `<link rel="alternate">` + sitemap.xml 에서 충분히 발견됨.

### 5. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

test -d src/app/rss.xml
test -f src/app/rss.xml/route.ts
grep -n "application/rss+xml" src/app/layout.tsx
```

수동 smoke:
- `pnpm dev` → `curl http://localhost:3000/rss.xml | head -30` → RSS 2.0 XML 출력 확인
- W3C Feed Validator 또는 https://validator.w3.org/feed/ 에 production URL 입력 → 유효성 검증
- 글 상세 페이지 view-source → `<link rel="alternate" type="application/rss+xml">` 존재

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/app/rss.xml/route.ts` | 신규 |
| `src/app/layout.tsx` | 수정 (metadata.alternates.types) |
| `src/infra/db/repositories/PostRepository.ts` | 수정 (필요 시 getRecentActive 추가) |

## Out of Scope

- 카테고리별 RSS (`/category/[name]/rss.xml`) — 결정상 OOS
- Atom 1.0 feed 별도 (RSS 2.0 만)
- RSS reader 등록 알림 / 통계
- `<content:encoded>` 본문 full HTML — description summary 만

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| extractDescription 이 HTML 태그 누적 (PR #118 미머지 시) | PR #118 머지 후 plan027 실행 권장. 미머지 상태에서도 escapeXml 이 추가 안전망 — RSS 가 깨지진 않음 |
| publication date 누락 (createdAt null) | fallback `new Date()` — 빈 글 시점 |
| GUID 가 URL 인 경우 글 path 변경 시 RSS reader 가 새 글로 인식 | 의도된 동작 — path 변경은 사실상 새 글이라 OK |
| RSS XML escape 누락으로 reader 깨짐 | escapeXml 헬퍼로 모든 사용자 입력 처리. title/description/url 모두 적용 |
