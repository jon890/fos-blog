import { describe, expect, it, vi, beforeEach } from "vitest";
import { parsePath, PostSyncService } from "./PostSyncService";
import type { PostRepository } from "@/infra/db/repositories/PostRepository";
import type { getFileContent, getFileCommitDates } from "@/infra/github/api";

describe("parsePath", () => {
  it("루트 경로 파일 — category는 확장자 포함 파일명, title은 확장자 제거", () => {
    const result = parsePath("intro.md");
    expect(result.category).toBe("intro.md"); // category: pathParts[0], 확장자 미제거
    expect(result.foldersList).toEqual([]);
    expect(result.subcategory).toBeUndefined();
    expect(result.title).toBe("intro"); // title: pathParts[last], 확장자 제거
  });

  it("1단계 경로 — category와 파일명 분리", () => {
    const result = parsePath("AI/intro.md");
    expect(result.category).toBe("AI");
    expect(result.foldersList).toEqual([]);
    expect(result.subcategory).toBeUndefined();
    expect(result.title).toBe("intro");
  });

  it("2단계 경로 — subcategory는 첫 번째 폴더", () => {
    const result = parsePath("AI/RAG/intro.md");
    expect(result.category).toBe("AI");
    expect(result.foldersList).toEqual(["RAG"]);
    expect(result.subcategory).toBe("RAG");
    expect(result.title).toBe("intro");
  });

  it("3단계 이상 경로 — foldersList에 중간 폴더 모두 포함", () => {
    const result = parsePath("AI/RAG/deep/intro.md");
    expect(result.category).toBe("AI");
    expect(result.foldersList).toEqual(["RAG", "deep"]);
    expect(result.subcategory).toBe("RAG");
    expect(result.title).toBe("intro");
  });

  it("파일명의 언더스코어를 공백으로 변환한다", () => {
    const result = parsePath("AI/hello_world_guide.md");
    expect(result.title).toBe("hello world guide");
  });

  it(".mdx 확장자도 제거한다", () => {
    const result = parsePath("AI/intro.mdx");
    expect(result.title).toBe("intro");
  });

  it("빈 문자열 — category는 uncategorized", () => {
    const result = parsePath("");
    expect(result.category).toBe("uncategorized");
    expect(result.foldersList).toEqual([]);
  });
});

describe("PostSyncService.upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeMocks() {
    const postRepo = {
      getPostId: vi.fn(),
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as PostRepository;

    const githubApi = {
      getFileContent: vi.fn(),
      getFileCommitDates: vi.fn().mockResolvedValue(null),
    } as unknown as { getFileContent: typeof getFileContent; getFileCommitDates: typeof getFileCommitDates };

    return { postRepo, githubApi };
  }

  it("getFileContent가 null을 반환하면 'skipped'를 반환한다", async () => {
    const { postRepo, githubApi } = makeMocks();
    vi.mocked(githubApi.getFileContent).mockResolvedValue(null);

    const service = new PostSyncService(postRepo, githubApi);
    const result = await service.upsert("AI/intro.md");

    expect(result).toBe("skipped");
    expect(postRepo.create).not.toHaveBeenCalled();
    expect(postRepo.update).not.toHaveBeenCalled();
  });

  it("기존 포스트가 없으면 postRepo.create를 호출하고 'added'를 반환한다", async () => {
    const { postRepo, githubApi } = makeMocks();
    vi.mocked(githubApi.getFileContent).mockResolvedValue({ content: "# Hello", sha: "sha123" } as never);
    vi.mocked(postRepo.getPostId).mockResolvedValue(null);

    const service = new PostSyncService(postRepo, githubApi);
    const result = await service.upsert("AI/intro.md");

    expect(result).toBe("added");
    expect(postRepo.create).toHaveBeenCalledOnce();
    expect(postRepo.update).not.toHaveBeenCalled();
  });

  it("기존 포스트가 있으면 postRepo.update를 호출하고 'updated'를 반환한다", async () => {
    const { postRepo, githubApi } = makeMocks();
    vi.mocked(githubApi.getFileContent).mockResolvedValue({ content: "# Hello", sha: "sha456" } as never);
    vi.mocked(postRepo.getPostId).mockResolvedValue(42);

    const service = new PostSyncService(postRepo, githubApi);
    const result = await service.upsert("AI/intro.md");

    expect(result).toBe("updated");
    expect(postRepo.update).toHaveBeenCalledWith(42, expect.objectContaining({ sha: "sha456" }));
    expect(postRepo.create).not.toHaveBeenCalled();
  });
});
