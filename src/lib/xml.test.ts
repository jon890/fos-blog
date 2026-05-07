import { describe, expect, it } from "vitest";
import { escapeXml } from "./xml";

describe("escapeXml", () => {
  it("escapes < and >", () => {
    expect(escapeXml("a < b > c")).toBe("a &lt; b &gt; c");
  });

  it("escapes & before other entities", () => {
    expect(escapeXml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("escapes single and double quotes", () => {
    expect(escapeXml(`it's "ok"`)).toBe("it&apos;s &quot;ok&quot;");
  });

  it("returns identical string when no special chars", () => {
    expect(escapeXml("hello world 123")).toBe("hello world 123");
  });

  it("escapes all five special characters together", () => {
    expect(escapeXml(`<a href="x">&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;"
    );
  });

  it("handles empty string", () => {
    expect(escapeXml("")).toBe("");
  });

  it("preserves Korean and unicode", () => {
    expect(escapeXml("한글 & test")).toBe("한글 &amp; test");
  });
});
