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
          <div
            style={{
              fontSize: 22,
              color: OG_COLORS.textSecondary,
              marginBottom: 20,
            }}
          >
            {breadcrumb}
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
            {icon} {current}
          </div>
          <div
            style={{
              fontSize: 32,
              color: OG_COLORS.textSecondary,
            }}
          >
            {`${contents.posts.length}개의 글, ${contents.folders.length}개의 폴더`}
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
          ? [{ name: "Noto Sans KR", data: font, weight: 700, style: "normal" }]
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
