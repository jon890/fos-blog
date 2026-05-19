import { describe, expect, it, vi } from "vitest";
import { toHtml } from "hast-util-to-html";

// vitest node 환경에서 server-only 가드 우회
vi.mock("server-only", () => ({}));

import { parseMarkdownToHast } from "./unified-pipeline";

describe("sanitize", () => {
  it("script 태그 제거", async () => {
    const md = "본문\n\n<script>alert(1)</script>\n\n끝";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("iframe 태그 제거", async () => {
    const md = "본문\n\n<iframe src=\"https://evil.com\"></iframe>\n\n끝";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("evil.com");
  });

  it("on* 이벤트 핸들러 제거", async () => {
    const md = `<a href="/x" onclick="alert(1)">link</a>`;
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("href=\"/x\"");
    expect(html).not.toContain("onclick");
  });

  it("javascript: URL 차단", async () => {
    const md = `[link](javascript:alert(1))`;
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).not.toContain("javascript:");
  });

  // 보존 케이스
  it("코드 블록 shiki span data-line + pretty-code allowlist 정합성", async () => {
    const md = "```ts\nconst x = 1;\n```";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("data-line");
    expect(html).toContain("data-rehype-pretty-code-figure");
    // allowlist 정합성 — pretty-code/shiki 가 출력하는 핵심 속성이 sanitize 후에도 살아남는지
    expect(html).toContain("data-language");
    expect(html).toContain("data-theme");
    // shiki 는 className 대신 inline style CSS 변수 (--shiki-light/dark) 방식 사용
    expect(html).toContain("--shiki-light");
    expect(html).toContain("--shiki-dark");
  });

  it("heading id (rehype-slug) 보존", async () => {
    const md = "## Hello World";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toMatch(/<h2[^>]*id="hello-world"/);
  });

  it("GFM 표 보존", async () => {
    const md = "| a | b |\n|---|---|\n| 1 | 2 |";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
  });

  it("inline code / strong / em 보존", async () => {
    const md = "**굵게** _이탤릭_ `코드`";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("<strong");
    expect(html).toContain("<em");
    expect(html).toContain("<code");
  });

  it("이미지 alt + src 보존", async () => {
    const md = `![cat](https://example.com/cat.png)`;
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("src=\"https://example.com/cat.png\"");
    expect(html).toContain("alt=\"cat\"");
  });

  it("정상 anchor 의 href 보존", async () => {
    const md = `[link](https://example.com)`;
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("href=\"https://example.com\"");
  });
});
