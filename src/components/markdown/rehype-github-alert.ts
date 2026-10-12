import type { Element, ElementContent, Root } from "hast";

export const ALERT_TYPES = ["note", "tip", "important", "warning", "caution"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n|$)/i;

function isElement(node: ElementContent): node is Element {
  return node.type === "element";
}

/**
 * GitHub alert 문법(`> [!TIP]`)을 callout blockquote 로 바꾸는 작은 rehype 플러그인.
 * 마커가 없거나 모르는 종류(`[!FOO]`)는 건드리지 않아 일반 인용문으로 남는다.
 * 외부 플러그인은 의존성이 늘고 class 구조를 우리 sanitize/CSS 에 맞춰야 해서 직접 쓴다.
 */
export function rehypeGithubAlert() {
  return (tree: Root) => {
    const walk = (node: Root | Element) => {
      for (const child of node.children as ElementContent[]) {
        if (!isElement(child)) continue;
        if (child.tagName === "blockquote") transform(child);
        walk(child);
      }
    };
    walk(tree);
  };
}

function transform(quote: Element) {
  const paragraph = quote.children.find(
    (c): c is Element => isElement(c),
  );
  if (!paragraph || paragraph.tagName !== "p") return;

  const first = paragraph.children[0];
  if (!first || first.type !== "text") return;

  const match = MARKER.exec(first.value);
  if (!match) return;

  const type = match[1].toLowerCase() as AlertType;
  first.value = first.value.slice(match[0].length);
  if (first.value === "") paragraph.children.shift();
  if (paragraph.children.length === 0) {
    quote.children.splice(quote.children.indexOf(paragraph), 1);
  }

  quote.properties = {
    ...quote.properties,
    className: ["callout", `callout-${type}`],
    "data-callout": type,
  };
}
