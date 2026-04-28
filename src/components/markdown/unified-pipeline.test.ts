import { describe, it, expect, vi } from "vitest";

// vitest node 환경에서 server-only 가드 우회
vi.mock("server-only", () => ({}));

import type { Root, Element, RootContent } from "hast";
import { parseMarkdownToHast } from "./unified-pipeline";

// hast 트리 탐색 헬퍼 — Element.children(ElementContent[]) ⊂ RootContent[]
// 이므로 widening cast 안전. parent가 Element | Root 유니온일 때 .children
// 추론이 ElementContent[] | RootContent[] 로 갈라져 직접 .find() 불가 → 단언 필요.
function isElement(node: RootContent): node is Element {
  return node.type === "element";
}
function findChildElement(parent: Element | Root, tagName: string): Element | undefined {
  return (parent.children as RootContent[]).find(
    (c): c is Element => isElement(c) && c.tagName === tagName,
  );
}

describe("rehype-pretty-code output structure (regression guard for plan017)", () => {
  it("produces span tokens with --shiki-light + --shiki-dark CSS variables", async () => {
    const tree: Root = await parseMarkdownToHast("```ts\nconst x = 42;\n```");

    // figure > pre > code > span[data-line] > span[style="--shiki-..."]
    const figure = findChildElement(tree, "figure");
    expect(figure?.properties?.["data-rehype-pretty-code-figure"]).toBeDefined();
    if (!figure) throw new Error("figure missing");

    const pre = findChildElement(figure, "pre");
    expect(pre?.properties?.["data-language"]).toBe("ts");
    expect(String(pre?.properties?.["data-theme"] ?? "")).toContain("github-light");
    expect(String(pre?.properties?.["data-theme"] ?? "")).toContain("github-dark");
    if (!pre) throw new Error("pre missing");

    const code = findChildElement(pre, "code");
    if (!code) throw new Error("code missing");
    const lineSpan = code.children.find(
      (c): c is Element =>
        isElement(c) && c.tagName === "span" && c.properties?.["data-line"] !== undefined,
    );
    expect(lineSpan).toBeDefined();
    if (!lineSpan) throw new Error("lineSpan missing");

    // 토큰 span 들이 --shiki-light + --shiki-dark CSS 변수를 inline style 로 보유
    const tokenSpans = lineSpan.children.filter(
      (c): c is Element => isElement(c) && c.tagName === "span",
    );
    expect(tokenSpans.length).toBeGreaterThan(0);
    const styleStrs = tokenSpans.map((s) => String(s.properties?.style ?? ""));
    expect(styleStrs.some((s) => s.includes("--shiki-light"))).toBe(true);
    expect(styleStrs.some((s) => s.includes("--shiki-dark"))).toBe(true);
  });

  it("does NOT add .shiki className (selector contract held by globals.css)", async () => {
    const tree: Root = await parseMarkdownToHast("```ts\nconst x = 42;\n```");
    const figure = findChildElement(tree, "figure");
    if (!figure) throw new Error("figure missing");
    const pre = findChildElement(figure, "pre");

    // .shiki className 부재가 globals.css 의 .code-card-body pre span 셀렉터 선택의 근거.
    // 이게 깨지면 (= rehype-pretty-code 가 .shiki 부여하기 시작하면) globals.css 도 다시 검토 필요.
    // hast Properties.className 은 string[] | string | number 가능 — Array.isArray 가드로 안전 검증.
    const rawClassName = pre?.properties?.className;
    const className = Array.isArray(rawClassName) ? rawClassName : [];
    expect(className).not.toContain("shiki");
  });
});
