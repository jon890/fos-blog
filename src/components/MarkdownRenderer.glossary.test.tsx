import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));

import { MarkdownRenderer } from "./MarkdownRenderer";

describe("MarkdownRenderer glossary", () => {
  it("DB matchable term의 fullName을 GlossaryTooltip props까지 전달한다", async () => {
    const element = await MarkdownRenderer({
      content: "LLM을 활용한다.",
      basePath: "AI/intro",
      glossaryTerms: [
        {
          id: "llm",
          term: "LLM",
          fullName: "Large Language Model",
          aliases: [],
          summary: "대규모 언어 모델",
          caseSensitive: false,
        },
      ],
    });

    const html = renderToStaticMarkup(element);
    expect(html).toContain(
      'title="LLM — Large Language Model: 대규모 언어 모델"',
    );
    expect(html).toContain("cursor-help");
  });
});
