import { describe, expect, it, vi } from "vitest";
import type { ChangedFile } from "@/infra/github/api";
import { GlossarySyncService } from "./GlossarySyncService";

const validGlossary = JSON.stringify({
  version: 1,
  terms: [
    {
      id: "dependency-injection",
      term: "Dependency Injection",
      aliases: ["DI"],
      summary: "의존성을 외부에서 전달하는 설계 방식",
      description: "## Dependency Injection\n\n객체 생성과 사용을 분리합니다.",
      references: [
        { label: "Reference", url: "https://example.com/di" },
      ],
    },
  ],
});

function makeMocks(content: string | null = validGlossary) {
  const glossaryRepo: ConstructorParameters<typeof GlossarySyncService>[0] = {
    countTerms: vi.fn().mockResolvedValue(3),
    replaceTerms: vi.fn().mockResolvedValue(undefined),
  };
  const githubApi: ConstructorParameters<typeof GlossarySyncService>[1] = {
    getFileContent: vi.fn().mockResolvedValue(
      content === null ? null : { content, sha: "glossary-sha" },
    ),
  };
  return { glossaryRepo, githubApi };
}

function createService(mocks: ReturnType<typeof makeMocks>) {
  return new GlossarySyncService(mocks.glossaryRepo, mocks.githubApi);
}

describe("GlossarySyncService.syncDefinitions", () => {
  it("full mode는 고정 경로를 검증한 뒤 정의를 교체한다", async () => {
    const mocks = makeMocks();

    const result = await createService(mocks).syncDefinitions("full");

    expect(mocks.githubApi.getFileContent).toHaveBeenCalledWith("glossary.json");
    expect(mocks.glossaryRepo.replaceTerms).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "dependency-injection",
        aliases: ["DI"],
        caseSensitive: false,
      }),
    ]);
    expect(result).toEqual({ definitionsChanged: true, terms: 1 });
  });

  it("incremental 변경 목록에 원본이 없으면 fetch하지 않는다", async () => {
    const mocks = makeMocks();
    const changedFiles: ChangedFile[] = [
      { filename: "AI/intro.md", status: "modified" },
    ];

    const result = await createService(mocks).syncDefinitions(
      "incremental",
      changedFiles,
    );

    expect(mocks.githubApi.getFileContent).not.toHaveBeenCalled();
    expect(mocks.glossaryRepo.replaceTerms).not.toHaveBeenCalled();
    expect(result).toEqual({ definitionsChanged: false, terms: 3 });
  });

  it.each<{ name: string; files: ChangedFile[] }>([
    {
      name: "삭제",
      files: [{ filename: "glossary.json", status: "removed" }],
    },
    {
      name: "rename-away",
      files: [
        {
          filename: "archive/glossary.json",
          previous_filename: "glossary.json",
          status: "renamed",
        },
      ],
    },
  ])("$name는 기존 정의를 보존하고 실패한다", async ({ files }) => {
    const mocks = makeMocks();

    await expect(
      createService(mocks).syncDefinitions("incremental", files),
    ).rejects.toThrow("빈 terms 배열");
    expect(mocks.githubApi.getFileContent).not.toHaveBeenCalled();
    expect(mocks.glossaryRepo.replaceTerms).not.toHaveBeenCalled();
  });

  it("404 결과는 기존 정의를 보존하고 실패한다", async () => {
    const mocks = makeMocks(null);

    await expect(createService(mocks).syncDefinitions("full")).rejects.toThrow(
      "찾을 수 없습니다",
    );
    expect(mocks.glossaryRepo.replaceTerms).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON parse", "{"],
    [
      "Zod",
      JSON.stringify({
        version: 1,
        terms: [
          {
            id: "first",
            term: "React",
            aliases: [],
            summary: "첫 개념",
            description: "설명",
          },
          {
            id: "second",
            term: "REACT",
            aliases: [],
            summary: "둘째 개념",
            description: "설명",
            caseSensitive: true,
          },
        ],
      }),
    ],
  ])("%s 실패는 정의를 교체하지 않는다", async (_case, content) => {
    const mocks = makeMocks(content);

    await expect(createService(mocks).syncDefinitions("full")).rejects.toThrow();
    expect(mocks.glossaryRepo.replaceTerms).not.toHaveBeenCalled();
  });

  it("유효한 빈 terms 배열은 전체 삭제 의사로 전달한다", async () => {
    const mocks = makeMocks(JSON.stringify({ version: 1, terms: [] }));

    const result = await createService(mocks).syncDefinitions("full");

    expect(mocks.glossaryRepo.replaceTerms).toHaveBeenCalledWith([]);
    expect(result).toEqual({ definitionsChanged: true, terms: 0 });
  });
});
