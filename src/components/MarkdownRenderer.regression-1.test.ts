// Regression: ISSUE-001 — mermaid diagrams wrapped in dark-background <pre> in light mode
// Found by /qa on 2026-04-02
// Report: .gstack/qa-reports/qa-report-blog-fosworld-co-kr-2026-04-02.md
//
// Root cause: The `pre` component renderer in MarkdownRenderer applied `bg-gray-900`
// unconditionally. Mermaid code blocks render with light-theme SVG colors, but the
// surrounding <pre> was always dark — making the diagram area appear dark in light mode.

import { describe, it, expect } from "vitest";
import { isMermaidPreNode } from "./MarkdownRenderer";

describe("isMermaidPreNode", () => {
  it("returns true when pre contains a language-mermaid code child", () => {
    const node = {
      children: [
        {
          type: "element",
          properties: { className: ["language-mermaid"] },
        },
      ],
    };
    expect(isMermaidPreNode(node)).toBe(true);
  });

  it("returns false when pre contains a non-mermaid language", () => {
    const node = {
      children: [
        {
          type: "element",
          properties: { className: ["language-typescript"] },
        },
      ],
    };
    expect(isMermaidPreNode(node)).toBe(false);
  });

  it("returns false when pre contains a code block with no language class", () => {
    const node = {
      children: [
        {
          type: "element",
          properties: { className: [] },
        },
      ],
    };
    expect(isMermaidPreNode(node)).toBe(false);
  });

  it("returns false when pre has no children", () => {
    expect(isMermaidPreNode({})).toBe(false);
  });

  it("returns false when children contain only text nodes", () => {
    const node = {
      children: [
        {
          type: "text",
          properties: undefined,
        },
      ],
    };
    expect(isMermaidPreNode(node)).toBe(false);
  });

  it("returns true when mermaid is among multiple children", () => {
    const node = {
      children: [
        { type: "text", properties: undefined },
        {
          type: "element",
          properties: { className: ["language-mermaid"] },
        },
      ],
    };
    expect(isMermaidPreNode(node)).toBe(true);
  });
});
