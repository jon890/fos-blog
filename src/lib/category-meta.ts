/**
 * 카테고리 정규화 헬퍼.
 * - canonical 9개: ai / algorithm / db / devops / java / js / react / next / system
 * - 데이터 raw key (categoryIcons 의 keys + 미정의 키) 를 canonical 로 흡수
 * - 누락/미매핑 키는 모두 'system' 으로 default
 */

export type CanonicalCategory =
  | "ai"
  | "algorithm"
  | "db"
  | "devops"
  | "java"
  | "js"
  | "react"
  | "next"
  | "system";

const RAW_TO_CANONICAL: Record<string, CanonicalCategory> = {
  // raw → canonical (기존)
  AI: "ai",
  algorithm: "algorithm",
  database: "db",
  redis: "db",
  devops: "devops",
  java: "java",
  javascript: "js",
  html: "js",
  css: "js",
  react: "react",
  next: "next",
  // canonical → canonical self-map (Footer / 직접 호출 안전망)
  ai: "ai",
  db: "db",
  js: "js",
  // algorithm/devops/java/react/next 는 raw 값과 canonical 값이 동일하므로 위 라인이 그대로 self-map 역할
  system: "system",
};

export function toCanonicalCategory(raw: string): CanonicalCategory {
  return RAW_TO_CANONICAL[raw] ?? "system";
}

/**
 * canonical 에서 oklch hue (degrees) 로 매핑.
 * Round 2 mockup 의 POSTS 데이터 hue 와 일치 — 토큰의 color-cat 토큰 (canonical key 별) 와도 일치.
 */
const CANONICAL_TO_HUE: Record<CanonicalCategory, number> = {
  ai: 285,
  algorithm: 25,
  db: 55,
  devops: 145,
  java: 180,
  js: 90,
  react: 220,
  next: 0,
  system: 250,
};

export function getCategoryHue(raw: string): number {
  return CANONICAL_TO_HUE[toCanonicalCategory(raw)];
}

/**
 * inline style 의 `--cat-color` CSS variable 값 (mockup 패턴).
 * 컴포넌트에서 `style={{ "--cat-color": getCategoryColor(post.category) } as CSSProperties}` 형태로 사용.
 */
export function getCategoryColor(raw: string): string {
  return `oklch(0.74 0.09 ${getCategoryHue(raw)})`;
}

/**
 * Tailwind arbitrary class 에서 토큰 참조 시 사용 (canonical 9개에 한해 토큰 존재).
 * 주의: 이 주석에 Tailwind 클래스처럼 보이는 패턴 (대괄호, 별표, 중괄호) 을 쓰지 말 것.
 * Tailwind v4 content scanner 가 클래스 후보로 추출해서 globals.css parse error 발생.
 * (canonical 9개에 한해 토큰 존재)
 */
export function getCategoryTokenVar(raw: string): string {
  return `--color-cat-${toCanonicalCategory(raw)}`;
}
