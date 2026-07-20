import { describe, expect, it } from "vitest";
import { scanGlossaryMentions } from "./glossary-mention-scanner";

const terms = [
  { id: "react", term: "React", aliases: [], caseSensitive: false },
  { id: "mermaid", term: "Mermaid", aliases: [], caseSensitive: false },
];

describe("scanGlossaryMentions", () => {
  it("frontmatter와 heading은 제외하고 일반 본문을 AST로 찾는다", () => {
    const markdown = `---
title: React
tags: [React]
---
# React

본문의 React는 찾는다.`;

    expect([...scanGlossaryMentions(markdown, terms)]).toEqual(["react"]);
    expect([...scanGlossaryMentions("---\ntitle: React\n---\n본문 없음", terms)]).toEqual([]);
    expect([...scanGlossaryMentions("# React", terms)]).toEqual([]);
  });

  it("link와 linkReference 하위 text를 제외한다", () => {
    const markdown = `[React](https://example.com)과 [React][docs]

[docs]: https://example.com`;

    expect([...scanGlossaryMentions(markdown, terms)]).toEqual([]);
  });

  it("code, inlineCode, Mermaid fenced code를 제외한다", () => {
    const markdown = "`React`\n\n```ts\nReact\n```\n\n```mermaid\nMermaid\n```";

    expect([...scanGlossaryMentions(markdown, terms)]).toEqual([]);
  });

  it("math와 inlineMath를 제외한다", () => {
    const markdown = "$React$\n\n$$\nReact\n$$";

    expect([...scanGlossaryMentions(markdown, terms)]).toEqual([]);
  });

  it("html 하위 원문을 제외한다", () => {
    expect([...scanGlossaryMentions("<span>React</span>", terms)]).toEqual([]);
  });

  it("같은 용어가 여러 text node에 있어도 한 번만 반환한다", () => {
    expect([...scanGlossaryMentions("React와 **React**", terms)]).toEqual(["react"]);
  });
});
