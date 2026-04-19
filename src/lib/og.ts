import fs from "node:fs/promises";
import path from "node:path";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export async function loadOgFont(): Promise<ArrayBuffer> {
  const fontPath = path.join(
    process.cwd(),
    "public/fonts/NotoSansKR-Bold-subset.ttf"
  );
  const buf = await fs.readFile(fontPath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

export async function loadOgLogoDataUrl(): Promise<string> {
  const logoPath = path.join(process.cwd(), "public/logo.png");
  const buf = await fs.readFile(logoPath);
  return `data:image/png;base64,${buf.toString("base64")}`;
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

export const OG_COLORS = {
  bgGradientStart: "#1e1b4b",
  bgGradientMid: "#3b82f6",
  bgGradientEnd: "#8b5cf6",
  textPrimary: "#ffffff",
  textSecondary: "#cbd5e1",
  badgeBg: "rgba(255,255,255,0.12)",
  badgeBorder: "rgba(255,255,255,0.2)",
} as const;

export const OG_LAYOUT = {
  padding: "80px",
  logoBottom: 24,
  logoLeft: 24,
  logoSize: 48,
  logoBorderRadius: 8,
} as const;
