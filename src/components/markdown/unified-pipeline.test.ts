import { describe, it, expect, vi } from "vitest";

// vitest node 환경에서 server-only 가드 우회
vi.mock("server-only", () => ({}));

import type { Root, Element, RootContent } from "hast";
import { toHtml } from "hast-util-to-html";
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

describe("KaTeX math rendering", () => {
  it("인라인 수식 $x^2$ 가 span.katex 으로 변환", async () => {
    const md = "이것은 $x^2$ 수식.";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain('class="katex"');
    expect(html).toContain("x");
  });

  it("블록 수식 $$...$$ 가 span.katex-display 으로 변환", async () => {
    // remark-math 는 $$ 가 독립 줄일 때 mathFlow(display) 로 인식
    const md = "$$\n\\int_0^1 x\\,dx\n$$";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("katex-display");
  });

  it("invalid LaTeX 은 빨간 텍스트 fallback (throwOnError: false)", async () => {
    const md = "$\\frac{1}$";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    // rehype-katex 버전마다 fallback 표현이 다름: className `katex-error` 또는 inline `color:#cc0000`.
    // 둘 중 하나라도 출현하면 OK. 위 await 가 throw 안 한 사실 자체가 throwOnError:false 동작을 증명.
    expect(html).toMatch(/katex-error|color\s*:\s*#?cc0000/i);
  });

  it("KaTeX 출력 className 이 sanitize 통과 (katex prefix)", async () => {
    const md = "$a + b$";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    // sanitize 후에도 katex 클래스 유지
    expect(html).toMatch(/class="[^"]*katex[^"]*"/);
  });
});
