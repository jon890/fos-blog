/**
 * plan009 카테고리 토큰의 satori 호환 hex 매핑.
 * 원본 oklch(0.74 0.09 H) — sRGB 변환은 culori(formatHex)로 사전 계산.
 * satori 는 oklch 미지원이라 직접 hex 박아 넣음.
 *
 * og.ts(서버 전용)와 Avatar.tsx(클라이언트) 양쪽의 단일 소스.
 */
export const OG_CATEGORY_HEX: Record<string, string> = {
  ai: "#a4a3e2",        // oklch(0.74 0.09 285)
  algorithm: "#de958e", // oklch(0.74 0.09 25)
  db: "#d79c73",        // oklch(0.74 0.09 55)
  devops: "#87ba88",    // oklch(0.74 0.09 145)
  java: "#64bead",      // oklch(0.74 0.09 180)
  js: "#c1a966",        // oklch(0.74 0.09 90)
  react: "#64b8d2",     // oklch(0.74 0.09 220)
};

export const OG_CATEGORY_DEFAULT_HEX = "#3fbac9"; // brand-400 fallback

const OG_CATEGORY_ALIAS: Record<string, string> = {
  database: "db",
  javascript: "js",
};

export function getCategoryHex(category: string): string {
  const raw = category.toLowerCase();
  const key = OG_CATEGORY_ALIAS[raw] ?? raw;
  return OG_CATEGORY_HEX[key] ?? OG_CATEGORY_DEFAULT_HEX;
}
