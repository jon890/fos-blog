// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Material } from "@/lib/study/contracts";
import { MaterialCard } from "./MaterialCard";

afterEach(cleanup);

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 1,
    contentKey: "url:fixture",
    canonicalUrl: "https://example.test/article",
    title: "React 상태 관리",
    publishedAt: "2026-09-01T00:00:00.000Z",
    excerpt: "짧은 발췌",
    tags: ["react"],
    kind: "feed-article",
    sources: [{ sourceKey: "example", sourceName: "Example", category: "techBlog" }],
    state: { starred: false, read: false, note: "", version: 0, updatedAt: null },
    previouslyRecommended: false,
    ...overrides,
  };
}

describe("MaterialCard", () => {
  it("발행일이 없을 때 대체 안내와 안전한 새 탭 원문 링크를 표시한다", () => {
    render(<MaterialCard material={material({ publishedAt: null })} onSaveState={vi.fn()} />);

    expect(screen.getByText(/발행일 정보 없음/)).toBeTruthy();
    const link = screen.getByRole("link", { name: /원문 열기/ });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("발췌와 메모 HTML 문자열을 일반 텍스트로 표시한다", () => {
    const html = "<img src=x onerror=alert(1)>메모";
    render(<MaterialCard material={material({ excerpt: html, state: { starred: false, read: false, note: html, version: 0, updatedAt: null } })} onSaveState={vi.fn()} />);

    expect(screen.getAllByText(html)).toHaveLength(2);
    expect(document.querySelector("img")).toBeNull();
  });
});
