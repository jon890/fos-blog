import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import logger from "@/lib/logger";
import { getRepositories, PostRepository } from "@/infra/db/repositories";
import { extractTitle, extractDescription } from "@/lib/markdown";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "@/infra/db/constants";
import {
  OG_WIDTH,
  OG_HEIGHT,
  OG_COLORS,
  OG_LAYOUT,
  loadOgFont,
  loadOgLogoDataUrl,
  truncateForOg,
} from "@/lib/og";

export const runtime = "nodejs";
export const revalidate = 60;

const log = logger.child({ module: "app/api/og/posts" });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const decoded = slug.map(decodeURIComponent).join("/");

  let font: ArrayBuffer | null = null;
  let logo: string | null = null;
  const [fontResult, logoResult] = await Promise.allSettled([
    loadOgFont(),
    loadOgLogoDataUrl(),
  ]);
  font = fontResult.status === "fulfilled" ? fontResult.value : null;
  logo = logoResult.status === "fulfilled" ? logoResult.value : null;
  if (fontResult.status === "rejected") {
    log.warn(
      {
        component: "og-post",
        operation: "loadFont",
        err: fontResult.reason instanceof Error ? fontResult.reason : new Error(String(fontResult.reason)),
      },
      "font load failed"
    );
  }
  if (logoResult.status === "rejected") {
    log.warn(
      {
        component: "og-post",
        operation: "loadLogo",
        err: logoResult.reason instanceof Error ? logoResult.reason : new Error(String(logoResult.reason)),
      },
      "logo load failed"
    );
  }

  let data: Awaited<ReturnType<PostRepository["getPost"]>> = null;
  try {
    const { post } = getRepositories();
    data = await post.getPost(decoded);
  } catch (e) {
    log.warn(
      {
        component: "og-post",
        operation: "getPost",
        slug: decoded,
        err: e instanceof Error ? e : new Error(String(e)),
      },
      "post fetch failed, using fallback"
    );
    data = null;
  }

  const title = data
    ? (extractTitle(data.content) ?? data.post.title)
    : "FOS Study";
  const description = data
    ? truncateForOg(extractDescription(data.content), 120)
    : "";
  const category = data?.post.category ?? "";
  const icon = categoryIcons[category] ?? DEFAULT_CATEGORY_ICON;
  const showBadge = Boolean(data && category);

  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            background: `linear-gradient(135deg, ${OG_COLORS.bgGradientStart} 0%, ${OG_COLORS.bgGradientMid} 50%, ${OG_COLORS.bgGradientEnd} 100%)`,
            padding: OG_LAYOUT.padding,
            position: "relative",
          }}
        >
          {showBadge && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: OG_COLORS.badgeBg,
                border: `1px solid ${OG_COLORS.badgeBorder}`,
                borderRadius: 24,
                padding: "8px 20px",
                fontSize: 24,
                color: OG_COLORS.textPrimary,
                marginBottom: 28,
              }}
            >
              {icon} {category}
            </div>
          )}
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: OG_COLORS.textPrimary,
              lineHeight: 1.2,
              marginBottom: 28,
              display: "-webkit-box",
              overflow: "hidden",
            }}
          >
            {title}
          </div>
          {description && (
            <div
              style={{
                fontSize: 32,
                color: OG_COLORS.textSecondary,
                lineHeight: 1.5,
              }}
            >
              {description}
            </div>
          )}
          {logo && (
            <img
              src={logo}
              width={OG_LAYOUT.logoSize}
              height={OG_LAYOUT.logoSize}
              alt="FOS Study"
              style={{
                position: "absolute",
                bottom: OG_LAYOUT.logoBottom,
                left: OG_LAYOUT.logoLeft,
                borderRadius: OG_LAYOUT.logoBorderRadius,
              }}
            />
          )}
        </div>
      ),
      {
        width: OG_WIDTH,
        height: OG_HEIGHT,
        fonts: font
          ? [{ name: "Noto Sans KR", data: font, weight: 700, style: "normal" }]
          : [],
      }
    );
  } catch (e) {
    log.error(
      {
        component: "og-post",
        operation: "ImageResponse",
        slug: decoded,
        err: e instanceof Error ? e : new Error(String(e)),
      },
      "OG image render failed"
    );
    return new Response("Internal Server Error", { status: 500 });
  }
}
