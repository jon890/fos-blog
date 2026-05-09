import { describe, expect, it, vi, beforeEach } from "vitest";
import { MetadataSyncService } from "./MetadataSyncService";
import type { CategoryRepository } from "@/infra/db/repositories/CategoryRepository";
import type { FolderRepository } from "@/infra/db/repositories/FolderRepository";
import type { PostRepository } from "@/infra/db/repositories/PostRepository";
import type { getFileContent } from "@/infra/github/api";

function makeMocks() {
  const postRepo = {
    getCategoryStats: vi.fn(),
    getAllPostPaths: vi.fn(),
  } as unknown as PostRepository;

  const categoryRepo = {
    syncAll: vi.fn().mockResolvedValue(undefined),
  } as unknown as CategoryRepository;

  const folderRepo = {
    getAll: vi.fn().mockResolvedValue(new Map()),
    upsert: vi.fn().mockResolvedValue(undefined),
    ensureFolder: vi.fn().mockResolvedValue(undefined),
  } as unknown as FolderRepository;

  const githubApi = {
    getFileContent: vi.fn(),
  } as unknown as { getFileContent: typeof getFileContent };

  return { postRepo, categoryRepo, folderRepo, githubApi };
}

describe("MetadataSyncService.updateCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getCategoryStats 결과를 syncAll에 올바르게 매핑한다", async () => {
    const { postRepo, categoryRepo, folderRepo, githubApi } = makeMocks();

    vi.mocked(postRepo.getCategoryStats).mockResolvedValue([
      { category: "AI", count: 5 },
      { category: "database", count: 3 },
    ]);

    const service = new MetadataSyncService(categoryRepo, folderRepo, postRepo, githubApi);
    await service.updateCategories();

    expect(postRepo.getCategoryStats).toHaveBeenCalledOnce();
    expect(categoryRepo.syncAll).toHaveBeenCalledWith([
      { name: "AI", slug: "AI", icon: "🤖", postCount: 5 },
      { name: "database", slug: "database", icon: "🗄️", postCount: 3 },
    ]);
  });

  it("categoryIcons에 없는 카테고리는 기본 아이콘(📁)을 사용한다", async () => {
    const { postRepo, categoryRepo, folderRepo, githubApi } = makeMocks();

    vi.mocked(postRepo.getCategoryStats).mockResolvedValue([
      { category: "unknown-topic", count: 2 },
    ]);

    const service = new MetadataSyncService(categoryRepo, folderRepo, postRepo, githubApi);
    await service.updateCategories();

    expect(categoryRepo.syncAll).toHaveBeenCalledWith([
      { name: "unknown-topic", slug: "unknown-topic", icon: "📁", postCount: 2 },
    ]);
  });

  it("post 가 0 건이면 syncAll([]) 호출되어 모든 카테고리 row 삭제", async () => {
    const { postRepo, categoryRepo, folderRepo, githubApi } = makeMocks();

    vi.mocked(postRepo.getCategoryStats).mockResolvedValue([]);

    const service = new MetadataSyncService(categoryRepo, folderRepo, postRepo, githubApi);
    await service.updateCategories();

    expect(categoryRepo.syncAll).toHaveBeenCalledWith([]);
  });
});
