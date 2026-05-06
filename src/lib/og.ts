import fs from "node:fs/promises";
import path from "node:path";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

let fontCache: Promise<ArrayBuffer> | null = null;
let logoCache: Promise<string> | null = null;

export function loadOgFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  fontCache = (async () => {
    const fontPath = path.join(
      process.cwd(),
      "public/fonts/Pretendard-Bold-subset.woff"
    );
    const buf = await fs.readFile(fontPath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  })().catch((e) => {
    fontCache = null;
    throw e;
  });
  return fontCache;
}

export function loadOgLogoDataUrl(): Promise<string> {
  if (logoCache) return logoCache;
  logoCache = (async () => {
    const logoPath = path.join(process.cwd(), "public/logo.png");
    const buf = await fs.readFile(logoPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  })().catch((e) => {
    logoCache = null;
    throw e;
  });
  return logoCache;
}

/**
 * OG 이미지 영역에 들어가도록 문자열 길이 제한.
 * 한글 기준 120자 근처에서 잘라 "..." 추가.
 */
export function truncateForOg(text: string, max = 120): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + "...";
}

// plan009 dark mode token — satori 호환 hex
export const OG_COLORS = {
  bgBase: "#000000",
  bgAccent: "#0d0d0f",

  textPrimary: "#f4f4f5",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",

  brand: "#3fbac9",
  brandSubtle: "rgba(63, 186, 201, 0.12)",
  brandBorder: "rgba(63, 186, 201, 0.3)",

  border: "rgba(255, 255, 255, 0.08)",
} as const;

export const OG_LAYOUT = {
  padding: "80px",
  logoBottom: 24,
  logoLeft: 24,
  logoSize: 48,
  logoBorderRadius: 8,
  brandBarHeight: 4,
} as const;

export { OG_CATEGORY_HEX, OG_CATEGORY_DEFAULT_HEX, getCategoryHex } from "@/lib/og-palette";

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function hexWithAlpha(hex: string, alpha: number): string {
  if (!HEX_PATTERN.test(hex)) {
    return `rgba(63, 186, 201, ${alpha})`; // OG_CATEGORY_DEFAULT_HEX(#3fbac9) 의 rgba — satori 무효 CSS 회피
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
