import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCommit: vi.fn(),
  getTree: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("./client", () => ({
  octokit: {
    git: {
      getCommit: mocks.getCommit,
      getTree: mocks.getTree,
    },
  },
  OWNER: "owner",
  REPO: "repo",
  BRANCH: "main",
}));

vi.mock("@/lib/logger", () => ({
  default: { child: () => ({ warn: mocks.warn }) },
}));

import { getRepositoryFolderPaths } from "./api";

describe("getRepositoryFolderPaths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCommit.mockResolvedValue({ data: { tree: { sha: "root-sha" } } });
  });

  it("recursive tree에서 최상위와 하위 폴더 경로를 수집한다", async () => {
    mocks.getTree.mockResolvedValue({
      data: {
        truncated: false,
        tree: [
          { path: "AI", type: "tree", sha: "ai-sha" },
          { path: "AI/RAG", type: "tree", sha: "rag-sha" },
          { path: "AI/RAG/intro.md", type: "blob", sha: "file-sha" },
        ],
      },
    });

    const result = await getRepositoryFolderPaths("head-sha");

    expect(result).toEqual(new Set(["AI", "AI/RAG"]));
    expect(mocks.getTree).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      tree_sha: "root-sha",
      recursive: "1",
    });
  });

  it("빈 repository tree는 빈 Set을 반환한다", async () => {
    mocks.getTree.mockResolvedValue({
      data: { truncated: false, tree: [] },
    });

    await expect(getRepositoryFolderPaths("head-sha")).resolves.toEqual(
      new Set(),
    );
  });

  it("recursive tree가 잘리면 하위 tree를 비재귀 순회해 경로를 완성한다", async () => {
    mocks.getTree
      .mockResolvedValueOnce({ data: { truncated: true, tree: [] } })
      .mockResolvedValueOnce({
        data: {
          truncated: false,
          tree: [{ path: "AI", type: "tree", sha: "ai-sha" }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          truncated: false,
          tree: [{ path: "RAG", type: "tree", sha: "rag-sha" }],
        },
      })
      .mockResolvedValueOnce({ data: { truncated: false, tree: [] } });

    const result = await getRepositoryFolderPaths("head-sha");

    expect(result).toEqual(new Set(["AI", "AI/RAG"]));
    expect(mocks.getTree).toHaveBeenCalledTimes(4);
  });

  it("비재귀 tree도 잘리면 불완전 상태를 한 번 경고하고 null을 반환한다", async () => {
    mocks.getTree
      .mockResolvedValueOnce({ data: { truncated: true, tree: [] } })
      .mockResolvedValueOnce({ data: { truncated: true, tree: [] } });

    await expect(getRepositoryFolderPaths("head-sha")).resolves.toBeNull();
    expect(mocks.warn).toHaveBeenCalledOnce();
  });

  it("필수 tree 정보가 없으면 null을 반환한다", async () => {
    mocks.getTree
      .mockResolvedValueOnce({ data: { truncated: true, tree: [] } })
      .mockResolvedValueOnce({
        data: {
          truncated: false,
          tree: [{ path: "AI", type: "tree", sha: null }],
        },
      });

    await expect(getRepositoryFolderPaths("head-sha")).resolves.toBeNull();
    expect(mocks.warn).toHaveBeenCalledOnce();
  });

  it("GitHub API 오류는 한 번 경고하고 null을 반환한다", async () => {
    mocks.getCommit.mockRejectedValue(new Error("GitHub 오류"));

    await expect(getRepositoryFolderPaths("head-sha")).resolves.toBeNull();
    expect(mocks.warn).toHaveBeenCalledOnce();
  });
});
