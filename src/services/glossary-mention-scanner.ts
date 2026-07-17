import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import {
  createGlossaryMatcher,
  type GlossaryMatcherTerm,
} from "@/lib/glossary-matcher";
import { parseFrontMatter } from "@/lib/markdown";

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
};

const EXCLUDED_SUBTREES = new Set([
  "heading",
  "link",
  "linkReference",
  "code",
  "inlineCode",
  "math",
  "inlineMath",
  "html",
]);

const markdownParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

export function scanGlossaryMentions(
  markdown: string,
  terms: readonly GlossaryMatcherTerm[],
): Set<string> {
  const content = parseFrontMatter(markdown).content;
  const tree = markdownParser.parse(content) as MarkdownNode;
  const matcher = createGlossaryMatcher(terms);
  const matchedIds = new Set<string>();

  visit(tree, (text) => {
    matcher.match(text, matchedIds);
  });

  return matchedIds;
}

function visit(node: MarkdownNode, onText: (text: string) => void): void {
  if (EXCLUDED_SUBTREES.has(node.type)) return;
  if (node.type === "text" && typeof node.value === "string") {
    onText(node.value);
    return;
  }
  let htmlDepth = 0;
  for (const child of node.children ?? []) {
    if (child.type === "html") {
      htmlDepth = Math.max(0, htmlDepth + getHtmlDepthDelta(child.value ?? ""));
      continue;
    }
    if (htmlDepth === 0) visit(child, onText);
  }
}

function getHtmlDepthDelta(value: string): number {
  if (/^<\//.test(value)) return -1;
  if (/\/>$/.test(value) || /^<(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i.test(value)) {
    return 0;
  }
  return /^<[A-Za-z][^>]*>$/.test(value) ? 1 : 0;
}
