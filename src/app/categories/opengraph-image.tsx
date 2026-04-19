import { ImageResponse } from "next/og";
import logger from "@/lib/logger";
import { getRepositories } from "@/infra/db/repositories";
import type { CategoryData } from "@/infra/db/types";
import {
  OG_WIDTH,
  OG_HEIGHT,
  OG_COLORS,
  OG_LAYOUT,
  loadOgFont,
  loadOgLogoDataUrl,
} from "@/lib/og";

const log = logger.child({ module: "app/categories/opengraph-image" });

export const runtime = "nodejs";
export const revalidate = 60;
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";
export const alt = "카테고리 | FOS Study";

export default async function CategoriesOgImage() {
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
        component: "og-categories",
        operation: "loadFont",
        err: fontResult.reason instanceof Error ? fontResult.reason : new Error(String(fontResult.reason)),
      },
      "font load failed"
    );
  }
  if (logoResult.status === "rejected") {
    log.warn(
      {
        component: "og-categories",
        operation: "loadLogo",
        err: logoResult.reason instanceof Error ? logoResult.reason : new Error(String(logoResult.reason)),
      },
      "logo load failed"
    );
  }

  let categories: CategoryData[] = [];
  try {
    const { category } = getRepositories();
    categories = await category.getCategories();
  } catch (e) {
    log.warn(
      {
        component: "og-categories",
        operation: "getCategories",
        err: e instanceof Error ? e : new Error(String(e)),
      },
      "categories fetch failed, rendering fallback"
    );
    categories = [];
  }

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
              fontSize: 28,
              color: OG_COLORS.textSecondary,
              marginBottom: 24,
            }}
          >
            FOS Study
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
            📂 카테고리
          </div>
          <div
            style={{
              fontSize: 36,
              color: OG_COLORS.textSecondary,
            }}
          >
            {`${categories.length}개의 카테고리`}
          </div>
          {logo && (
            <img
              src={logo}
              alt="FOS Study"
              width={OG_LAYOUT.logoSize}
              height={OG_LAYOUT.logoSize}
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
        ...size,
        fonts: font
          ? [{ name: "Noto Sans KR", data: font, weight: 700, style: "normal" }]
          : [],
      }
    );
  } catch (e) {
    log.error(
      {
        component: "og-categories",
        operation: "ImageResponse",
        err: e instanceof Error ? e : new Error(String(e)),
      },
      "OG image render failed"
    );
    return new Response("Internal Server Error", { status: 500 });
  }
}
