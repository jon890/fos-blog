import { beforeEach, describe, expect, it, vi } from "vitest";
import { MetadataSyncService } from "./MetadataSyncService";

function makeMocks() {
  const categoryRepo: ConstructorParameters<typeof MetadataSyncService>[0] = {
    syncAll: vi.fn().mockResolvedValue(undefined),
  };
  const folderRepo: ConstructorParameters<typeof MetadataSyncService>[1] = {
    clearReadme: vi.fn().mockResolvedValue(undefined),
    ensureFolder: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue(new Map()),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
  const postRepo: ConstructorParameters<typeof MetadataSyncService>[2] = {
    getAllPostPaths: vi.fn().mockResolvedValue([]),
    getCategoryStats: vi.fn().mockResolvedValue([]),
  };
  const githubApi: ConstructorParameters<typeof MetadataSyncService>[3] = {
    getFileContent: vi.fn().mockResolvedValue(null),
  };
  return { categoryRepo, folderRepo, postRepo, githubApi };
}

function createService(mocks: ReturnType<typeof makeMocks>): MetadataSyncService {
  return new MetadataSyncService(
    mocks.categoryRepo,
    mocks.folderRepo,
    mocks.postRepo,
    mocks.githubApi,
  );
}

describe("MetadataSyncService.refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("category 재계산과 새 README upsert를 한 번에 수행한다", async () => {
    const mocks = makeMocks();
    vi.mocked(mocks.postRepo.getCategoryStats).mockResolvedValue([
      { category: "AI", count: 2 },
    ]);
    vi.mocked(mocks.postRepo.getAllPostPaths).mockResolvedValue([
      "AI/RAG/intro.md",
    ]);
    vi.mocked(mocks.githubApi.getFileContent).mockImplementation(async (path) =>
      path === "AI/RAG/README.md"
        ? { content: "# RAG", sha: "new-sha" }
        : null,
    );

    const result = await createService(mocks).refresh();

    expect(mocks.categoryRepo.syncAll).toHaveBeenCalledWith([
      { name: "AI", slug: "AI", icon: "🤖", postCount: 2 },
    ]);
    expect(mocks.folderRepo.upsert).toHaveBeenCalledWith(
      "AI/RAG",
      "# RAG",
      "new-sha",
    );
    expect(result.changedReadmes).toEqual([
      { path: "AI/RAG/README.md", operation: "upsert" },
    ]);
  });

  it("원본 README가 사라지면 DB readme를 지우고 delete change를 반환한다", async () => {
    const mocks = makeMocks();
    vi.mocked(mocks.postRepo.getAllPostPaths).mockResolvedValue([
      "AI/RAG/intro.md",
    ]);
    vi.mocked(mocks.folderRepo.getAll).mockResolvedValue(
      new Map([
        ["AI", { id: 1, sha: null }],
        ["AI/RAG", { id: 2, sha: "old-sha" }],
      ]),
    );

    const result = await createService(mocks).refresh();

    expect(mocks.folderRepo.clearReadme).toHaveBeenCalledWith("AI/RAG");
    expect(result.changedReadmes).toEqual([
      { path: "AI/RAG/README.md", operation: "delete" },
    ]);
  });

  it.each(["readme.md", "Readme.md"])(
    "%s upsert와 후속 delete에 같은 canonical path를 반환한다",
    async (readmeName) => {
      const mocks = makeMocks();
      let readmeExists = true;
      let storedSha: string | null = null;
      vi.mocked(mocks.postRepo.getAllPostPaths).mockResolvedValue([
        "AI/RAG/intro.md",
      ]);
      vi.mocked(mocks.folderRepo.getAll).mockImplementation(async () =>
        new Map([
          ["AI", { id: 1, sha: null }],
          ["AI/RAG", { id: 2, sha: storedSha }],
        ]),
      );
      vi.mocked(mocks.folderRepo.upsert).mockImplementation(
        async (_path, _content, sha) => {
          storedSha = sha;
        },
      );
      vi.mocked(mocks.githubApi.getFileContent).mockImplementation(
        async (path) =>
          readmeExists && path === `AI/RAG/${readmeName}`
            ? { content: "# RAG", sha: "readme-sha" }
            : null,
      );

      const service = createService(mocks);
      const upsertResult = await service.refresh();
      readmeExists = false;
      const deleteResult = await service.refresh();

      expect(upsertResult.changedReadmes).toEqual([
        { path: "AI/RAG/README.md", operation: "upsert" },
      ]);
      expect(deleteResult.changedReadmes).toEqual([
        { path: "AI/RAG/README.md", operation: "delete" },
      ]);
      expect(mocks.folderRepo.clearReadme).toHaveBeenCalledWith("AI/RAG");
    },
  );

  it("활성 post가 사라져 folder가 소멸해도 README delete change를 반환한다", async () => {
    const mocks = makeMocks();
    vi.mocked(mocks.folderRepo.getAll).mockResolvedValue(
      new Map([["AI/RAG", { id: 2, sha: "old-sha" }]]),
    );

    const result = await createService(mocks).refresh();

    expect(mocks.folderRepo.clearReadme).toHaveBeenCalledWith("AI/RAG");
    expect(result.changedReadmes).toEqual([
      { path: "AI/RAG/README.md", operation: "delete" },
    ]);
  });

  it("README SHA가 같으면 DB와 변경 목록을 갱신하지 않는다", async () => {
    const mocks = makeMocks();
    vi.mocked(mocks.postRepo.getAllPostPaths).mockResolvedValue([
      "AI/RAG/intro.md",
    ]);
    vi.mocked(mocks.folderRepo.getAll).mockResolvedValue(
      new Map([
        ["AI", { id: 1, sha: null }],
        ["AI/RAG", { id: 2, sha: "same-sha" }],
      ]),
    );
    vi.mocked(mocks.githubApi.getFileContent).mockImplementation(async (path) =>
      path === "AI/RAG/README.md"
        ? { content: "# RAG", sha: "same-sha" }
        : null,
    );

    const result = await createService(mocks).refresh();

    expect(mocks.folderRepo.upsert).not.toHaveBeenCalled();
    expect(mocks.folderRepo.clearReadme).not.toHaveBeenCalled();
    expect(result.changedReadmes).toEqual([]);
  });
});
