// ===== 카테고리 아이콘 매핑 =====

export const categoryIcons: Record<string, string> = {
  AI: "🤖",
  algorithm: "🧮",
  architecture: "🏗️",
  database: "🗄️",
  devops: "🚀",
  finance: "💰",
  git: "📝",
  go: "🐹",
  html: "🌐",
  http: "📡",
  internet: "🌍",
  interview: "💼",
  java: "☕",
  javascript: "⚡",
  kafka: "📨",
  network: "🔌",
  react: "⚛️",
  redis: "🔴",
  resume: "📄",
  css: "🎨",
  기술공유: "📢",
};

export const DEFAULT_CATEGORY_ICON = "📁";

export function getCategoryIcon(category: string): string {
  const key = category.trim();
  const topLevel = key.split("/")[0] ?? "";
  return categoryIcons[key] ?? categoryIcons[topLevel] ?? DEFAULT_CATEGORY_ICON;
}
