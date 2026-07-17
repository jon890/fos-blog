import "server-only";

import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import {
  createGlossaryMatcher,
  type GlossaryMatcherTerm,
} from "@/lib/glossary-matcher";

const EXCLUDED_TAGS = new Set([
  "a",
  "abbr",
  "code",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "pre",
]);

export function applyGlossaryTransform(
  tree: Root,
  terms: readonly GlossaryMatcherTerm[],
  enabled = true,
): Root {
  if (!enabled || terms.length === 0) return tree;

  const matcher = createGlossaryMatcher(terms);
  const matchedIds = new Set<string>();

  transformChildren(tree, matcher.match, matchedIds);
  return tree;
}

function transformChildren(
  parent: Root | Element,
  match: ReturnType<typeof createGlossaryMatcher>["match"],
  matchedIds: Set<string>,
): void {
  const transformed: RootContent[] = [];

  for (const child of parent.children as RootContent[]) {
    if (child.type === "text") {
      transformed.push(...replaceText(child, match, matchedIds));
      continue;
    }

    if (child.type === "element" && !isExcludedSubtree(child)) {
      transformChildren(child, match, matchedIds);
    }
    transformed.push(child);
  }

  if (parent.type === "root") {
    parent.children = transformed;
  } else {
    parent.children = transformed as ElementContent[];
  }
}

function replaceText(
  node: Text,
  match: ReturnType<typeof createGlossaryMatcher>["match"],
  matchedIds: Set<string>,
): RootContent[] {
  const matches = match(node.value, matchedIds);
  if (matches.length === 0) return [node];

  const children: RootContent[] = [];
  let offset = 0;

  for (const glossaryMatch of matches) {
    if (glossaryMatch.start > offset) {
      children.push({
        type: "text",
        value: node.value.slice(offset, glossaryMatch.start),
      });
    }
    children.push({
      type: "element",
      tagName: "abbr",
      properties: { dataGlossaryId: glossaryMatch.id },
      children: [{ type: "text", value: glossaryMatch.expression }],
    });
    offset = glossaryMatch.end;
  }

  if (offset < node.value.length) {
    children.push({ type: "text", value: node.value.slice(offset) });
  }
  return children;
}

function isExcludedSubtree(node: Element): boolean {
  if (EXCLUDED_TAGS.has(node.tagName)) return true;

  const classNames = normalizeClassNames(node.properties?.className);
  return (
    classNames.some(
      (className) =>
        className === "mermaid" ||
        className.startsWith("katex") ||
        className === "language-mermaid",
    ) || node.properties?.["data-language"] === "mermaid"
  );
}

function normalizeClassNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(/\s+/);
  return [];
}
