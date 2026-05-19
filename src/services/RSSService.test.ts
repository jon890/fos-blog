import { describe, it, expect, vi } from "vitest";
import { createRSSService } from "./RSSService";

describe("RSSService.getRecentForFeedLite (plan045)", () => {
  it("repo.getRecentActiveLite 결과를 그대로 반환", async () => {
    const mockData = [
      {
        title: "A",
        path: "x/a.md",
        slug: "a",
        category: "tech",
        subcategory: null,
        folders: [],
        description: "desc A",
        createdAt: new Date(),
      },
      {
        title: "B",
        path: "x/b.md",
        slug: "b",
        category: "tech",
        subcategory: null,
        folders: [],
        description: null,
        createdAt: new Date(),
      },
    ];
    const repos = {
      post: {
        getRecentActive: vi.fn(),
        getRecentActiveLite: vi.fn().mockResolvedValue(mockData),
      },
    };
    const service = createRSSService(repos);
    const result = await service.getRecentForFeedLite({ limit: 50 });
    expect(repos.post.getRecentActiveLite).toHaveBeenCalledWith({ limit: 50 });
    expect(result).toBe(mockData);
  });

  it("limit 미지정 시 50 기본값", async () => {
    const repos = {
      post: {
        getRecentActive: vi.fn(),
        getRecentActiveLite: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createRSSService(repos);
    await service.getRecentForFeedLite();
    expect(repos.post.getRecentActiveLite).toHaveBeenCalledWith({ limit: 50 });
  });

  it("기존 getRecentForFeed 는 그대로 동작 (회귀 보호)", async () => {
    const mockData = [
      {
        title: "A",
        path: "x/a.md",
        slug: "a",
        category: "tech",
        subcategory: null,
        folders: [],
        description: "d",
        content: "full md",
        createdAt: new Date(),
      },
    ];
    const repos = {
      post: {
        getRecentActive: vi.fn().mockResolvedValue(mockData),
        getRecentActiveLite: vi.fn(),
      },
    };
    const service = createRSSService(repos);
    const result = await service.getRecentForFeed({ limit: 10 });
    expect(repos.post.getRecentActive).toHaveBeenCalledWith({ limit: 10 });
    expect(result).toBe(mockData);
  });
});
