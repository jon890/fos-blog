import { describe, expect, it, vi } from "vitest";
import type { DbInstance } from "./BaseRepository";
import { FolderRepository } from "./FolderRepository";

const basePost = {
  title: "글",
  path: "AI/intro.md",
  slug: "intro.md",
  category: "AI",
  categories: ["AI"],
  subcategory: null,
  folders: ["AI"],
  description: null,
  thumbnailUrl: null,
};

function makeRepository(postRows: unknown[]) {
  const postQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(postRows),
  };
  const folderQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  const db = {
    select: vi
      .fn()
      .mockReturnValueOnce(postQuery)
      .mockReturnValueOnce(folderQuery),
  };

  return new FolderRepository(db as unknown as DbInstance);
}

describe("FolderRepository.getFolderContents", () => {
  it("소문자 요청으로 대문자 저장 경로를 조회하고 접두사 오탐을 제외한다", async () => {
    const repository = makeRepository([
      basePost,
      { ...basePost, title: "소문자 글", path: "ai/guide.md" },
      { ...basePost, title: "다른 폴더 글", path: "AIOps/other.md" },
    ]);

    const result = await repository.getFolderContents("ai");

    expect(result.posts.map(({ path }) => path)).toEqual([
      "AI/intro.md",
      "ai/guide.md",
    ]);
  });

  it("대문자 요청으로 소문자 저장 경로를 조회한다", async () => {
    const repository = makeRepository([
      { ...basePost, path: "ai/intro.md" },
    ]);

    const result = await repository.getFolderContents("AI");

    expect(result.posts.map(({ path }) => path)).toEqual(["ai/intro.md"]);
  });
});
