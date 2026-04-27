// Regression: ISSUE-001 — mermaid diagrams wrapped in dark-background <pre> in light mode
// Found by /qa on 2026-04-02
// Report: .gstack/qa-reports/qa-report-blog-fosworld-co-kr-2026-04-02.md
//
// Root cause: The `pre` component renderer in MarkdownRenderer applied `bg-gray-900`
// unconditionally. Mermaid code blocks render with light-theme SVG colors, but the
// surrounding <pre> was always dark — making the diagram area appear dark in light mode.
//
// plan012 update: After rehype-pretty-code migration, mermaid blocks carry
// `data-language="mermaid"` on the <pre> node instead of `className="language-mermaid"`
// on the child <code>. isMermaidPreNode() now supports both detection methods.

import { describe, it, expect } from "vitest";
import { isMermaidPreNode } from "./MarkdownRenderer";

describe("isMermaidPreNode", () => {
  // --- Legacy: className-based detection (pre-pretty-code) ---

  it("returns true when pre contains a language-mermaid code child (legacy)", () => {
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

  it("returns false when pre contains a non-mermaid language (legacy)", () => {
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

  it("returns false when pre contains a code block with no language class (legacy)", () => {
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

  it("returns false when children contain only text nodes (legacy)", () => {
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

  it("returns true when mermaid is among multiple children (legacy)", () => {
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

  // --- New: data-language-based detection (post-pretty-code) ---

  it("returns true when pre has data-language='mermaid' property (plan012)", () => {
    const node = {
      properties: { "data-language": "mermaid" },
      children: [],
    };
    expect(isMermaidPreNode(node)).toBe(true);
  });

  it("returns false when pre has data-language='typescript' property (plan012)", () => {
    const node = {
      properties: { "data-language": "typescript" },
      children: [],
    };
    expect(isMermaidPreNode(node)).toBe(false);
  });

  it("returns false when pre has no data-language property and no children (plan012)", () => {
    const node = {
      properties: {},
      children: [],
    };
    expect(isMermaidPreNode(node)).toBe(false);
  });
});
