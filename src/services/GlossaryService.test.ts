import { describe, expect, it, vi } from "vitest";
import { GlossaryService } from "./GlossaryService";

function makeRepository() {
  return {
    getMatchableTerms: vi.fn().mockResolvedValue([]),
    getDefinitions: vi.fn().mockResolvedValue([
      {
        id: "dependency-injection",
        term: "Dependency Injection",
        fullName: null,
        aliases: ["DI"],
        summary: "요약",
        description: "설명",
        caseSensitive: false,
        references: [],
      },
    ]),
    getMentions: vi.fn().mockResolvedValue([
      {
        termId: "dependency-injection",
        pageType: "post" as const,
        pagePath: "AI/DI 소개.md",
        pageTitle: "DI 소개",
        pageUpdatedAt: new Date("2026-01-02"),
      },
      {
        termId: "dependency-injection",
        pageType: "category-readme" as const,
        pagePath: "AI/설계/README.md",
        pageTitle: "설계",
        pageUpdatedAt: new Date("2026-01-01"),
      },
    ]),
  };
}

describe("GlossaryService", () => {
  it("definition에 최근순 mention projection과 canonical URL을 결합한다", async () => {
    const service = new GlossaryService(makeRepository());

    const result = await service.getGlossaryPageData();

    expect(result.terms[0]?.mentions.map((mention) => mention.url)).toEqual([
      "/posts/AI/DI%20%EC%86%8C%EA%B0%9C.md",
      "/category/AI/%EC%84%A4%EA%B3%84",
    ]);
  });

  it("repository 오류를 숨기지 않는다", async () => {
    const repository = makeRepository();
    const error = new Error("DB failure");
    repository.getDefinitions.mockRejectedValue(error);

    await expect(
      new GlossaryService(repository).getGlossaryPageData(),
    ).rejects.toBe(error);
  });
});
