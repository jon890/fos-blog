import { NextResponse } from "next/server";
import { createDefaultRSSService } from "@/services";
import { extractDescription } from "@/lib/markdown";
import { escapeXml } from "@/lib/xml";
import { env } from "@/env";
import logger from "@/lib/logger";

export const runtime = "nodejs";
export const revalidate = 600;

const log = logger.child({ module: "app/rss" });

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;
const SITE_TITLE = "FOS Study";
const SITE_DESCRIPTION = "한 명의 백엔드 엔지니어가 매일 쌓는 학습 노트";

export async function GET() {
  try {
    const rss = createDefaultRSSService();
    const posts = await rss.getRecentForFeed({ limit: 50 });

    const items = posts
      .map((p) => {
        const url = `${SITE_URL}/posts/${p.path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`;
        const desc = extractDescription(p.content ?? p.description ?? "", 300);
        const pubDate = (p.createdAt ?? new Date()).toUTCString();
        return `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <category>${escapeXml(p.category)}</category>
      <description>${escapeXml(desc)}</description>
    </item>`;
      })
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>
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
    log.error(
      { err: e instanceof Error ? e : new Error(String(e)) },
      "RSS render failed"
    );
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
