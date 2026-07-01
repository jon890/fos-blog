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

function resolveCategoryIconKey(category: string): string | undefined {
  const exact = categoryIcons[category] ? category : undefined;
  if (exact) return exact;

  const normalized = category.toLowerCase();
  return Object.keys(categoryIcons).find((key) => key.toLowerCase() === normalized);
}

export function getCategoryIcon(category: string): string {
  const key = category.trim();
  const topLevel = key.split("/")[0] ?? "";
  const iconKey = resolveCategoryIconKey(key) ?? resolveCategoryIconKey(topLevel);
  return iconKey ? categoryIcons[iconKey] : DEFAULT_CATEGORY_ICON;
}
