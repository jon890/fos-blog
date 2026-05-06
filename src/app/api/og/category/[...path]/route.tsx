import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import logger from "@/lib/logger";
import { getRepositories } from "@/infra/db/repositories";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "@/infra/db/constants";
import {
  OG_WIDTH,
  OG_HEIGHT,
  OG_COLORS,
  OG_LAYOUT,
  loadOgFont,
  loadOgLogoDataUrl,
  getCategoryHex,
  hexWithAlpha,
} from "@/lib/og";
import type { FolderContentsResult } from "@/infra/db/types";

export const runtime = "nodejs";
export const revalidate = 60;

const log = logger.child({ module: "app/api/og/category" });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const decoded = segments.map(decodeURIComponent);
  if (decoded.length === 0) {
    return new Response("Not Found", { status: 404 });
  }
  const folderPath = decoded.join("/");
  const current = decoded[decoded.length - 1];
  const breadcrumb = decoded.join(" > ");

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
        component: "og-category",
        operation: "loadFont",
        err: fontResult.reason instanceof Error ? fontResult.reason : new Error(String(fontResult.reason)),
      },
      "font load failed"
    );
  }
  if (logoResult.status === "rejected") {
    log.warn(
      {
        component: "og-category",
        operation: "loadLogo",
        err: logoResult.reason instanceof Error ? logoResult.reason : new Error(String(logoResult.reason)),
      },
      "logo load failed"
    );
  }

  let contents: FolderContentsResult = { posts: [], folders: [], readme: null };
  try {
    const { folder } = getRepositories();
    contents = await folder.getFolderContents(folderPath);
  } catch (e) {
    log.warn(
      {
        component: "og-category",
        operation: "getFolderContents",
        folderPath,
        err: e instanceof Error ? e : new Error(String(e)),
      },
      "folder contents fetch failed, rendering fallback"
    );
    contents = { posts: [], folders: [], readme: null };
  }

  const icon = categoryIcons[current] ?? DEFAULT_CATEGORY_ICON;
  const categoryHex = getCategoryHex(current);

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
            background: OG_COLORS.bgBase,
            padding: OG_LAYOUT.padding,
            position: "relative",
          }}
        >
          {/* 상단 brand teal 띠 */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: OG_LAYOUT.brandBarHeight,
              background: OG_COLORS.brand,
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: hexWithAlpha(categoryHex, 0.12),
              border: `1px solid ${hexWithAlpha(categoryHex, 0.3)}`,
              borderRadius: 24,
              padding: "8px 20px",
              fontSize: 24,
              color: categoryHex,
              marginBottom: 28,
            }}
          >
            {icon} {current}
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: OG_COLORS.textPrimary,
              lineHeight: 1.1,
              marginBottom: 24,
            }}
          >
            {breadcrumb}
          </div>
          <div
            style={{
              fontSize: 32,
              color: OG_COLORS.textSecondary,
            }}
          >
            {`${current} — 글 ${contents.posts.length}개 정리 모음`}
          </div>
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
          ? [{ name: "Pretendard", data: font, weight: 700, style: "normal" }]
          : [],
      }
    );
  } catch (e) {
    log.error(
      {
        component: "og-category",
        operation: "ImageResponse",
        folderPath,
        err: e instanceof Error ? e : new Error(String(e)),
      },
      "OG image render failed"
    );
    return new Response("Internal Server Error", { status: 500 });
  }
}
