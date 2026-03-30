// Markdown utility functions
import GithubSlugger from "github-slugger";

export interface FrontMatter {
  title?: string;
  date?: string;
  description?: string;
  tags?: string[];
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
    return frontMatter.description as string;
  }

  // Remove markdown syntax and get first paragraph
  const plainText = mainContent
    .replace(/^#+\s+.+$/gm, "") // Remove headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Replace links with text
    .replace(/[*_`~]/g, "") // Remove formatting
    .replace(/\n+/g, " ") // Replace newlines with spaces
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
