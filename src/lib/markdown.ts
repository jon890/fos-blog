// Markdown utility functions
import GithubSlugger from "github-slugger";
import type { Element as HastElement, ElementContent, Text } from "hast";

const HTML_TAG_RE = /<[^>]+>/g;

export interface FrontMatter {
  title?: string;
  date?: string;
  description?: string;
  tags?: string[];
  series?: string;
  /** YAML 파서가 `seriesOrder: 2` 를 number 로, `seriesOrder: "2"` 를 string 으로 반환할 수 있어 둘 다 허용. SyncService 에서 `Number()` + `Number.isFinite` 로 정규화. */
  seriesOrder?: number | string;
  [key: string]: unknown;
}

// Parse frontmatter from markdown content
export function parseFrontMatter(content: string): {
  frontMatter: FrontMatter;
  content: string;
} {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontMatterRegex);

  if (!match) {
    return { frontMatter: {}, content };
  }

  const frontMatterStr = match[1];
  const frontMatter: FrontMatter = {};

  // Simple YAML-like parsing
  const lines = frontMatterStr.split("\n");
  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Handle arrays (simple case)
      if (value.startsWith("[") && value.endsWith("]")) {
        const arrayContent = value.slice(1, -1);
        frontMatter[key] = arrayContent
          .split(",")
          .map((item) => item.trim().replace(/['"]/g, ""));
      } else {
        frontMatter[key] = value;
      }
    }
  }

  const contentWithoutFrontMatter = content.replace(frontMatterRegex, "");
  return { frontMatter, content: contentWithoutFrontMatter };
}

// Extract title from markdown content
export function extractTitle(content: string): string | null {
  // First try to get title from frontmatter
  const { frontMatter } = parseFrontMatter(content);
  if (frontMatter.title) {
    return frontMatter.title as string;
  }

  // Then try to find first h1
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1];
  }

  return null;
}

// Extract description from markdown content
export function extractDescription(
  content: string,
  maxLength: number = 200
): string {
  const { frontMatter, content: mainContent } = parseFrontMatter(content);

  if (frontMatter.description) {
    return frontMatter.description.replace(HTML_TAG_RE, " ").replace(/\s+/g, " ").trim();
  }

  // Remove markdown syntax and get first paragraph
  const plainText = mainContent
    .replace(HTML_TAG_RE, " ") // Remove HTML tags (<br>, <details> 등)
    .replace(/^#+\s+.+$/gm, "") // Remove headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Replace links with text
    .replace(/[*_`~]/g, "") // Remove formatting
    .replace(/\n+/g, " ") // Replace newlines with spaces
    .replace(/\s+/g, " ") // Collapse repeated whitespace from tag removal
    .trim();

  if (plainText.length > maxLength) {
    return plainText.slice(0, maxLength).trim() + "...";
  }

  return plainText;
}

// Get reading time estimate
export function getReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

// Generate table of contents from markdown
export interface TocItem {
  level: number;
  text: string;
  slug: string;
}

/**
 * Markdown 본문의 선두 H1 라인 + 뒤이은 공백 라인을 제거한다.
 * ADR-010 참조.
 */
export function stripLeadingH1(content: string): string {
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return content;
  if (!/^#\s+.+$/.test(lines[i])) return content;
  i++;
  while (i < lines.length && lines[i].trim() === "") i++;
  return lines.slice(i).join("\n");
}

export function generateTableOfContents(content: string): TocItem[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const toc: TocItem[] = [];
  const slugger = new GithubSlugger();
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2];
    // github-slugger를 사용하여 rehype-slug와 동일한 slug 생성
    const slug = slugger.slug(text);

    toc.push({ level, text, slug });
  }

  return toc;
}

// ============================================================
// Hast helpers for rehype-pretty-code integration
// ============================================================

/**
 * hast 트리에서 모든 text node 값을 이어붙임.
 * pretty-code 가 wrapping 한 [data-line] span 뒤에는 \n 삽입 (clipboard 복사 라인 보존).
 */
export function extractRawText(node: HastElement | ElementContent): string {
  if (node.type === "text") return (node as Text).value;
  if (node.type !== "element") return "";
  const el = node as HastElement;
  const isLine = el.properties?.["data-line"] !== undefined;
  const inner = (el.children ?? []).map(extractRawText).join("");
  return isLine ? inner + "\n" : inner;
}

/**
 * hast 서브트리에서 지정 tagName 의 첫 번째 element 를 찾아 텍스트 content 반환.
 * pretty-code 의 figcaption (filename) 추출에 사용.
 */
export function findChildText(
  node: HastElement,
  tagName: string,
): string | undefined {
  function search(n: HastElement | ElementContent): string | undefined {
    if (n.type !== "element") return undefined;
    const el = n as HastElement;
    if (el.tagName === tagName) {
      return (el.children ?? [])
        .filter((c): c is Text => c.type === "text")
        .map((c) => c.value)
        .join("");
    }
    for (const child of el.children ?? []) {
      const result = search(child);
      if (result !== undefined) return result;
    }
    return undefined;
  }
  return search(node);
}

/**
 * hast 서브트리에서 첫 번째 <code> element 의 지정 data-* 속성 값 반환.
 * pretty-code 의 data-language / data-theme 추출에 사용.
 */
export function findCodeProp(
  node: HastElement,
  propName: string,
): string | undefined {
  function search(n: HastElement | ElementContent): string | undefined {
    if (n.type !== "element") return undefined;
    const el = n as HastElement;
    if (el.tagName === "code") {
      const val = el.properties?.[propName];
      return typeof val === "string" ? val : undefined;
    }
    for (const child of el.children ?? []) {
      const result = search(child);
      if (result !== undefined) return result;
    }
    return undefined;
  }
  return search(node);
}
