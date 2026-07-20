import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mergeCategories,
  parsePath,
  PostSyncService,
  resolveFrontMatterMeta,
  warnUnknownFrontMatterCategories,
} from "./PostSyncService";

const loggerMock = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: { child: () => loggerMock },
}));

function makeMocks() {
  const postRepo: ConstructorParameters<typeof PostSyncService>[0] = {
    create: vi.fn().mockResolvedValue(undefined),
    deactive: vi.fn().mockResolvedValue(false),
    deactivateByIds: vi.fn().mockResolvedValue(0),
    getAllForSync: vi.fn().mockResolvedValue([]),
    getAllWithContent: vi.fn().mockResolvedValue([]),
    getPostId: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const githubApi: ConstructorParameters<typeof PostSyncService>[1] = {
    getDirectoryContents: vi.fn().mockResolvedValue([]),
    getFileContent: vi.fn().mockResolvedValue(null),
    getFileCommitDates: vi.fn().mockResolvedValue(null),
  };
  return { postRepo, githubApi };
}

describe("PostSyncService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncAll은 재귀 탐색 결과를 한 upsert 경로로 저장하고 변경 경로를 반환한다", async () => {
    const { postRepo, githubApi } = makeMocks();
    vi.mocked(githubApi.getDirectoryContents)
      .mockResolvedValueOnce([
        { name: "AI", path: "AI", sha: "dir-sha", type: "dir" },
      ])
      .mockResolvedValueOnce([
        { name: "intro.md", path: "AI/intro.md", sha: "new-sha", type: "file" },
      ]);
    vi.mocked(githubApi.getFileContent).mockResolvedValue({
      content: "# 새 제목\n\n본문",
      sha: "new-sha",
    });

    const result = await new PostSyncService(postRepo, githubApi).syncAll();

    expect(postRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ path: "AI/intro.md", title: "새 제목" }),
    );
    expect(result).toEqual({
      added: 1,
      updated: 0,
      deleted: 0,
      changedPosts: [{ path: "AI/intro.md", operation: "upsert" }],
      titles: { total: 0, updated: 0, skipped: 0 },
    });
  });

  it("syncAll은 SHA가 같은 글을 건너뛰고 사라진 활성 글을 delete로 반환한다", async () => {
    const { postRepo, githubApi } = makeMocks();
    vi.mocked(githubApi.getDirectoryContents).mockResolvedValue([
      { name: "keep.md", path: "AI/keep.md", sha: "same-sha", type: "file" },
    ]);
    vi.mocked(postRepo.getAllForSync).mockResolvedValue([
      { id: 1, path: "AI/keep.md", sha: "same-sha", isActive: true },
      { id: 2, path: "AI/gone.md", sha: "old-sha", isActive: true },
    ]);
    vi.mocked(postRepo.deactivateByIds).mockResolvedValue(1);

    const result = await new PostSyncService(postRepo, githubApi).syncAll();

    expect(githubApi.getFileContent).not.toHaveBeenCalled();
    expect(postRepo.deactivateByIds).toHaveBeenCalledWith([2]);
    expect(result.changedPosts).toEqual([
      { path: "AI/gone.md", operation: "delete" },
    ]);
  });

  it("syncChanged는 rename의 이전 경로 delete와 새 경로 upsert를 반환한다", async () => {
    const { postRepo, githubApi } = makeMocks();
    vi.mocked(postRepo.deactive).mockResolvedValue(true);
    vi.mocked(githubApi.getFileContent).mockResolvedValue({
      content: "# Renamed",
      sha: "rename-sha",
    });

    const result = await new PostSyncService(postRepo, githubApi).syncChanged([
      {
        status: "renamed",
        filename: "AI/new.md",
        previous_filename: "AI/old.md",
      },
    ]);

    expect(result).toMatchObject({ added: 1, updated: 0, deleted: 1 });
    expect(result.changedPosts).toEqual([
      { path: "AI/old.md", operation: "delete" },
      { path: "AI/new.md", operation: "upsert" },
    ]);
  });

  it("syncChanged는 README removed 이벤트도 기존 동작대로 비활성화한다", async () => {
    const { postRepo, githubApi } = makeMocks();
    vi.mocked(postRepo.deactive).mockResolvedValue(true);

    const result = await new PostSyncService(postRepo, githubApi).syncChanged([
      { status: "removed", filename: "AI/README.md" },
    ]);

    expect(postRepo.deactive).toHaveBeenCalledWith("AI/README.md");
    expect(result.changedPosts).toEqual([
      { path: "AI/README.md", operation: "delete" },
    ]);
  });

  it("retitleAll은 content 제목이 다른 글만 보정한다", async () => {
    const { postRepo, githubApi } = makeMocks();
    vi.mocked(postRepo.getAllWithContent).mockResolvedValue([
      { id: 1, path: "a.md", title: "같음", content: "# 같음" },
      { id: 2, path: "b.md", title: "이전", content: "# 변경" },
      { id: 3, path: "c.md", title: "없음", content: null },
    ]);

    const result = await new PostSyncService(postRepo, githubApi).retitleAll();

    expect(result).toEqual({ total: 3, updated: 1, skipped: 2 });
    expect(postRepo.update).toHaveBeenCalledOnce();
    expect(postRepo.update).toHaveBeenCalledWith(2, { title: "변경" });
  });
});

describe("PostSyncService helpers", () => {
  it("parsePath는 category, folder, title을 분리한다", () => {
    expect(parsePath("AI/RAG/hello_world.mdx")).toEqual({
      category: "AI",
      foldersList: ["RAG"],
      subcategory: "RAG",
      title: "hello world",
    });
  });

  it("mergeCategories는 경로 category를 우선하고 중복과 공백을 제거한다", () => {
    expect(mergeCategories("AI", [" AI ", "", "DevOps"])).toEqual([
      "AI",
      "DevOps",
    ]);
  });

  it("resolveFrontMatterMeta는 tag와 series metadata를 정규화한다", () => {
    expect(
      resolveFrontMatterMeta(
        { tags: ["AI", " ai "], series: "RAG", seriesOrder: "2" },
        "AI/rag.md",
      ),
    ).toEqual({ tags: ["ai"], series: "RAG", seriesOrder: 2 });
  });

  it("알려지지 않은 category key를 경고한다", () => {
    warnUnknownFrontMatterCategories("AI/rag.md", "AI", ["unknown/path"]);

    expect(loggerMock.warn).toHaveBeenCalledWith(
      { path: "AI/rag.md", categories: ["unknown/path"] },
      "frontmatter categories 에 알려지지 않은 category key 포함",
    );
  });
});
