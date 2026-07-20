import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Element, Root, RootContent } from "hast";
import { applyGlossaryTransform } from "./glossary-transform";

const terms = [
  {
    id: "llm",
    term: "LLM",
    aliases: ["large language model"],
    caseSensitive: false,
  },
];

function paragraph(value: string): Element {
  return {
    type: "element",
    tagName: "p",
    properties: {},
    children: [{ type: "text", value }],
  };
}

function glossaryNodes(tree: Root): Element[] {
  const found: Element[] = [];
  const visit = (nodes: RootContent[]) => {
    for (const node of nodes) {
      if (node.type !== "element") continue;
      if (node.tagName === "abbr") found.push(node);
      visit(node.children as RootContent[]);
    }
  };
  visit(tree.children);
  return found;
}

describe("applyGlossaryTransform", () => {
  it("문서 순서에서 같은 id의 최초 등장만 abbr로 바꾼다", () => {
    const tree: Root = {
      type: "root",
      children: [paragraph("LLM과 LLM, large language model")],
    };

    expect(applyGlossaryTransform(tree, terms)).toBe(tree);
    const matches = glossaryNodes(tree);
    expect(matches).toHaveLength(1);
    expect(matches[0].properties?.dataGlossaryId).toBe("llm");
    expect(matches[0].children).toEqual([{ type: "text", value: "LLM" }]);
  });

  it.each([
    ["h2", {}],
    ["a", {}],
    ["code", {}],
    ["pre", {}],
    ["abbr", {}],
    ["span", { className: ["katex"] }],
    ["span", { className: ["mermaid"] }],
    ["figure", { "data-language": "mermaid" }],
  ])("%s subtree를 제외한다", (tagName, properties) => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName,
          properties,
          children: [{ type: "text", value: "LLM" }],
        },
        paragraph("LLM"),
      ],
    };

    applyGlossaryTransform(tree, terms);
    expect(glossaryNodes(tree)).toHaveLength(tagName === "abbr" ? 2 : 1);
    const finalParagraph = tree.children[1] as Element;
    expect((finalParagraph.children[0] as Element).tagName).toBe("abbr");
  });

  it("비활성화되거나 용어가 없으면 tree를 변경하지 않는다", () => {
    const tree = { type: "root", children: [paragraph("LLM")] } as Root;
    const before = structuredClone(tree);

    applyGlossaryTransform(tree, terms, false);
    expect(tree).toEqual(before);
    applyGlossaryTransform(tree, []);
    expect(tree).toEqual(before);
  });
});
