import { getCategoryHue } from "./category-meta";

export interface ThumbnailPattern {
  hue: number;
  rotation: number;
  nodes: Array<{ left: number; top: number; size: number; opacity: number }>;
}

function hashCategory(category: string): number {
  let hash = 2166136261;
  for (const character of category.trim().toLowerCase() || "system") {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createThumbnailPattern(category: string): ThumbnailPattern {
  const hash = hashCategory(category);
  const nodes = Array.from({ length: 7 }, (_, index) => {
    const shifted = (hash >>> ((index * 4) % 24)) ^ Math.imul(index + 1, 2654435761);
    return {
      left: 8 + (shifted >>> 0) % 78,
      top: 10 + ((shifted >>> 8) >>> 0) % 68,
      size: 48 + ((shifted >>> 16) >>> 0) % 92,
      opacity: 0.18 + (((shifted >>> 24) >>> 0) % 28) / 100,
    };
  });

  return {
    hue: getCategoryHue(category),
    rotation: (hash % 50) - 25,
    nodes,
  };
}
