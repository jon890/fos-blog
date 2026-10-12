import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { toHtml } from "hast-util-to-html";
import { parseMarkdownToHast } from "./unified-pipeline";

async function render(markdown: string): Promise<string> {
  return toHtml(await parseMarkdownToHast(markdown));
}

describe("rehypeGithubAlert", () => {
  it.each(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"])(
    "[!%s] 를 callout 으로 바꾸고 마커 줄을 지운다",
    async (kind) => {
      const html = await render(`> [!${kind}]\n> 본문입니다.`);
      const lower = kind.toLowerCase();
      expect(html).toContain(`class="callout callout-${lower}"`);
      expect(html).toContain(`data-callout="${lower}"`);
      expect(html).toContain("본문입니다.");
      expect(html).not.toContain("[!");
    },
  );

  it("마커가 소문자여도 인식한다", async () => {
    expect(await render("> [!tip]\n> x")).toContain('data-callout="tip"');
  });

  it("같은 줄에 이어진 굵은 글씨와 링크를 보존한다", async () => {
    const html = await render(
      "> [!TIP]\n> **더 읽을 글**: [문서](./a.md)의 「절」.\n> 두 번째 줄.",
    );
    expect(html).toContain("<strong>더 읽을 글</strong>");
    expect(html).toContain('<a href="./a.md">문서</a>');
    expect(html).not.toContain("[!TIP]");
  });

  it("목록이 든 alert 의 중첩 목록을 보존한다", async () => {
    const html = await render(
      "> [!TIP]\n> **더 읽을 글**\n>\n> - [문서 A](../a.md)의 「절」\n>   - 설명\n> - [문서 B](../b.md)의 「절」",
    );
    expect(html).toContain('data-callout="tip"');
    expect(html.match(/<ul>/g)?.length).toBe(2);
    expect(html.match(/<li>/g)?.length).toBe(3);
  });

  it("마커만 있는 첫 문단은 빈 <p> 로 남기지 않는다", async () => {
    const html = await render("> [!NOTE]\n>\n> 본문");
    expect(html).not.toContain("<p></p>");
    expect(html).toContain("본문");
  });

  it("마커 없는 인용문은 일반 blockquote 로 둔다", async () => {
    const html = await render("> 그냥 인용문");
    expect(html).toContain("<blockquote>");
    expect(html).not.toContain("callout");
  });

  it("모르는 종류는 일반 인용문으로 두고 마커 글자를 남긴다", async () => {
    const html = await render("> [!FOO]\n> 본문");
    expect(html).toContain("<blockquote>");
    expect(html).not.toContain("callout");
    expect(html).toContain("[!FOO]");
  });

  it("문단 중간의 마커는 alert 로 보지 않는다", async () => {
    const html = await render("> 앞 글 [!TIP] 뒤 글");
    expect(html).not.toContain("callout");
  });

  it("sanitize 를 통과한 뒤에도 class 와 data-callout 이 유지된다", async () => {
    const html = await render("> [!WARNING]\n> 주의");
    expect(html).toMatch(/<blockquote[^>]*class="callout callout-warning"/);
    expect(html).toMatch(/<blockquote[^>]*data-callout="warning"/);
  });

  it("raw HTML blockquote 의 이벤트 핸들러는 여전히 지워진다", async () => {
    const html = await render('<blockquote onclick="x()">a</blockquote>');
    expect(html).not.toContain("onclick");
  });
});
