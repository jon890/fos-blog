import { describe, expect, it, vi, beforeEach } from "vitest";
import { PostService } from "./PostService";
import type { PostRepository } from "@/infra/db/repositories/PostRepository";

function makePostRepo(
  posts: Array<{ id: number; path: string; title: string; content: string | null }>,
): PostRepository {
  return {
    getPostsByCategory: vi.fn(),
    getRecentPosts: vi.fn(),
    getPostId: vi.fn(),
    getPost: vi.fn(),
    getAllPostPaths: vi.fn(),
    getAllPostsForSitemap: vi.fn(),
    getPostsByPaths: vi.fn(),
    getAllPostsForSidebar: vi.fn(),
    searchPosts: vi.fn(),
    deactive: vi.fn(),
    deactivateByIds: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    getAllForSync: vi.fn(),
    getAllWithContent: vi.fn().mockResolvedValue(posts),
    getCategoryStats: vi.fn(),
  } as unknown as PostRepository;
}

describe("PostService.retitleAll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("content가 없는 포스트는 스킵한다", async () => {
    const repo = makePostRepo([
      { id: 1, path: "AI/intro.md", title: "intro", content: null },
    ]);
    const service = new PostService(repo);

    const result = await service.retitleAll();

    expect(result).toEqual({ total: 1, updated: 0, skipped: 1 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("추출한 제목이 현재 제목과 같으면 스킵한다", async () => {
    const repo = makePostRepo([
      {
        id: 1,
        path: "AI/intro.md",
        title: "같은 제목",
        content: "# 같은 제목\n\n본문",
      },
    ]);
    const service = new PostService(repo);

    const result = await service.retitleAll();

    expect(result).toEqual({ total: 1, updated: 0, skipped: 1 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("추출한 제목이 다르면 update를 호출한다", async () => {
    const repo = makePostRepo([
      {
        id: 1,
        path: "AI/intro.md",
        title: "구 제목",
        content: "# 새로운 제목\n\n본문",
      },
    ]);
    const service = new PostService(repo);

    const result = await service.retitleAll();

    expect(result).toEqual({ total: 1, updated: 1, skipped: 0 });
    expect(repo.update).toHaveBeenCalledWith(1, { title: "새로운 제목" });
  });

  it("여러 포스트를 올바르게 집계한다", async () => {
    const repo = makePostRepo([
      { id: 1, path: "a.md", title: "새 제목", content: "# 새 제목\n본문" }, // 동일 → skip
      { id: 2, path: "b.md", title: "구 제목", content: "# 새 제목\n본문" }, // 변경 → update
      { id: 3, path: "c.md", title: "없음", content: null },                 // null → skip
    ]);
    const service = new PostService(repo);

    const result = await service.retitleAll();

    expect(result).toEqual({ total: 3, updated: 1, skipped: 2 });
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith(2, { title: "새 제목" });
  });
});
