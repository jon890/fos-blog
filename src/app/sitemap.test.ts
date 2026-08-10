import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getAllPostsForSitemap: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_SITE_URL: "https://example.com" },
}));

vi.mock("@/lib/logger", () => ({
  default: {
    child: vi.fn().mockReturnValue({ warn: mocks.warn }),
  },
}));

vi.mock("@/infra/db/repositories", () => ({
  getRepositories: vi.fn(() => ({
    category: { getCategories: mocks.getCategories },
    post: { getAllPostsForSitemap: mocks.getAllPostsForSitemap },
  })),
}));

import sitemap from "./sitemap";

const now = new Date("2026-08-10T00:00:00.000Z");

describe("sitemap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.getCategories.mockResolvedValue([]);
    mocks.getAllPostsForSitemap.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("카테고리 경로를 소문자로 정규화하고 URL 중복을 제거한다", async () => {
    const updatedAt = new Date("2026-08-09T00:00:00.000Z");
    mocks.getCategories.mockResolvedValue([{ slug: "AI" }]);
    mocks.getAllPostsForSitemap.mockResolvedValue([
      { path: "AI/agent/intro.md", updatedAt },
      { path: "ai/agent/second.md", updatedAt: null },
    ]);

    const result = await sitemap();
    const urls = result.map(({ url }) => url);

    expect(urls).toContain("https://example.com");
    expect(urls).toContain("https://example.com/posts/AI/agent/intro.md");
    expect(urls.filter((url) => url === "https://example.com/category/ai")).toHaveLength(1);
    expect(
      urls.filter((url) => url === "https://example.com/category/ai/agent"),
    ).toHaveLength(1);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("기존 sitemap 메타데이터 값을 유지한다", async () => {
    const updatedAt = new Date("2026-08-09T00:00:00.000Z");
    mocks.getCategories.mockResolvedValue([{ slug: "AI" }]);
    mocks.getAllPostsForSitemap.mockResolvedValue([
      { path: "AI/intro.md", updatedAt },
    ]);

    const result = await sitemap();

    expect(result.find(({ url }) => url === "https://example.com")).toEqual({
      url: "https://example.com",
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    });
    expect(
      result.find(({ url }) => url === "https://example.com/category/ai"),
    ).toEqual({
      url: "https://example.com/category/ai",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
    expect(
      result.find(
        ({ url }) => url === "https://example.com/posts/AI/intro.md",
      ),
    ).toEqual({
      url: "https://example.com/posts/AI/intro.md",
      lastModified: updatedAt,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  });

  it("동적 항목이 없으면 정적 페이지만 반환한다", async () => {
    const result = await sitemap();

    expect(result).toHaveLength(6);
    expect(result.every(({ url }) => !url.includes("/category/"))).toBe(true);
    expect(result.every(({ url }) => !url.includes("/posts/"))).toBe(true);
  });

  it("Repository 조회가 실패하면 정적 페이지만 반환한다", async () => {
    const error = new Error("DB down");
    mocks.getCategories.mockRejectedValue(error);

    const result = await sitemap();

    expect(result).toHaveLength(6);
    expect(mocks.warn).toHaveBeenCalledWith(
      { err: error },
      "Failed to fetch dynamic sitemap data",
    );
  });
});
