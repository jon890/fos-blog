import { describe, it, expect } from "vitest";
import { escapeHtml } from "./escape-html";

describe("escapeHtml", () => {
  it("escapes script tags", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("escapes ampersand", () => {
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });

  it("escapes all 5 characters in one pass", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("escapes consecutive duplicates", () => {
    expect(escapeHtml("&&&")).toBe("&amp;&amp;&amp;");
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("leaves plain text unchanged", () => {
    expect(escapeHtml("안녕 hello world")).toBe("안녕 hello world");
  });

  it("escapes img onerror payload", () => {
    expect(escapeHtml('<img onerror="x" src=y>')).toBe(
      "&lt;img onerror=&quot;x&quot; src=y&gt;"
    );
  });
});
