import { ImageResponse } from "next/og";
import logger from "@/lib/logger";
import {
  OG_WIDTH,
  OG_HEIGHT,
  OG_COLORS,
  OG_LAYOUT,
  loadOgFont,
  loadOgLogoDataUrl,
} from "@/lib/og";

const log = logger.child({ module: "app/opengraph-image" });

export const runtime = "nodejs";
export const revalidate = 60;
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";
export const alt = "FOS Study — 개발 학습 블로그";

export default async function HomeOgImage() {
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
        component: "og-home",
        operation: "loadFont",
        err: fontResult.reason instanceof Error ? fontResult.reason : new Error(String(fontResult.reason)),
      },
      "font load failed"
    );
  }
  if (logoResult.status === "rejected") {
    log.warn(
      {
        component: "og-home",
        operation: "loadLogo",
        err: logoResult.reason instanceof Error ? logoResult.reason : new Error(String(logoResult.reason)),
      },
      "logo load failed"
    );
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
            background: OG_COLORS.bgBase,
            padding: OG_LAYOUT.padding,
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              color: OG_COLORS.textPrimary,
              lineHeight: 1.1,
              marginBottom: 20,
            }}
          >
            FOS Study
          </div>
          <div
            style={{
              fontSize: 40,
              color: OG_COLORS.textPrimary,
              marginBottom: 32,
              opacity: 0.9,
            }}
          >
            개발 학습 블로그
          </div>
          <div
            style={{
              fontSize: 24,
              color: OG_COLORS.textSecondary,
            }}
          >
            AI · Algorithm · Database · DevOps
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
          ? [{ name: "Pretendard", data: font, weight: 700, style: "normal" }]
          : [],
      }
    );
  } catch (e) {
    log.error(
      {
        component: "og-home",
        operation: "ImageResponse",
        err: e instanceof Error ? e : new Error(String(e)),
      },
      "OG image render failed"
    );
    return new Response("Internal Server Error", { status: 500 });
  }
}
