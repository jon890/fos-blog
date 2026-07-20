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

const validSlaGlossary = JSON.stringify({
  version: 1,
  terms: [
    {
      id: "service-level-agreement",
      term: "SLA",
      fullName: "Service Level Agreement",
      aliases: ["서비스 수준 협약"],
      summary: "서비스 제공 수준을 합의한 계약",
      description: "가용성, 응답 시간과 같은 서비스 목표를 정의합니다.",
      references: [
        { label: "Google SRE", url: "https://sre.google/sre-book/service-level-objectives/" },
      ],
    },
  ],
});

function makeMocks(content: string | null = validGlossary) {
  const glossaryRepo: ConstructorParameters<typeof GlossarySyncService>[0] = {
    countMentions: vi.fn().mockResolvedValue(0),
    countTerms: vi.fn().mockResolvedValue(3),
    deletePageMentions: vi.fn().mockResolvedValue(undefined),
    getMatchableTerms: vi.fn().mockResolvedValue([
      {
        id: "dependency-injection",
        term: "Dependency Injection",
        aliases: ["DI"],
        summary: "의존성을 외부에서 전달하는 설계 방식",
        caseSensitive: false,
      },
    ]),
    replaceAllMentions: vi.fn().mockResolvedValue(undefined),
    replacePageMentions: vi.fn().mockResolvedValue(undefined),
    replaceTerms: vi.fn().mockResolvedValue(undefined),
  };
  const githubApi: ConstructorParameters<typeof GlossarySyncService>[1] = {
    getFileContent: vi.fn().mockResolvedValue(
      content === null ? null : { content, sha: "glossary-sha" },
    ),
  };
  const postRepo: ConstructorParameters<typeof GlossarySyncService>[2] = {
    getActiveMentionSources: vi.fn().mockResolvedValue([]),
    getActiveMentionSource: vi.fn().mockResolvedValue(null),
  };
  const folderRepo: ConstructorParameters<typeof GlossarySyncService>[3] = {
    getReadmeMentionSources: vi.fn().mockResolvedValue([]),
    getReadmeMentionSource: vi.fn().mockResolvedValue(null),
  };
  return { glossaryRepo, githubApi, postRepo, folderRepo };
}

function createService(mocks: ReturnType<typeof makeMocks>) {
  return new GlossarySyncService(
    mocks.glossaryRepo,
    mocks.githubApi,
    mocks.postRepo,
    mocks.folderRepo,
  );
}

describe("GlossarySyncService.syncDefinitions", () => {
  it("SLA, 별칭과 https reference를 포함한 version 1 fixture를 허용한다", async () => {
    const mocks = makeMocks(validSlaGlossary);

    await expect(createService(mocks).syncDefinitions("full")).resolves.toEqual({
      definitionsChanged: true,
      terms: 1,
    });
    expect(mocks.glossaryRepo.replaceTerms).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "service-level-agreement",
        aliases: ["서비스 수준 협약"],
        references: [
          expect.objectContaining({ url: expect.stringMatching(/^https:/) }),
        ],
      }),
    ]);
  });

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

  it.each([
    [
      "중복 id",
      {
        version: 1,
        terms: [
          { id: "sla", term: "SLA", summary: "첫 정의", description: "설명" },
          { id: "sla", term: "SLO", summary: "둘째 정의", description: "설명" },
        ],
      },
    ],
    [
      "대표 용어와 별칭 충돌",
      {
        version: 1,
        terms: [
          { id: "sla", term: "SLA", summary: "첫 정의", description: "설명" },
          {
            id: "agreement",
            term: "Agreement",
            aliases: ["sla"],
            summary: "둘째 정의",
            description: "설명",
          },
        ],
      },
    ],
    [
      "http reference",
      {
        version: 1,
        terms: [
          {
            id: "sla",
            term: "SLA",
            summary: "정의",
            description: "설명",
            references: [{ label: "unsafe", url: "http://example.com" }],
          },
        ],
      },
    ],
  ])("%s fixture는 기존 정의를 보존하고 실패한다", async (_case, input) => {
    const mocks = makeMocks(JSON.stringify(input));

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

describe("GlossarySyncService.syncMentions", () => {
  it("정의 변경 시 활성 post와 README를 전체 재색인한다", async () => {
    const mocks = makeMocks();
    vi.mocked(mocks.postRepo.getActiveMentionSources).mockResolvedValue([
      {
        path: "AI/intro.md",
        title: "DI 소개",
        content: "DI와 DI를 설명한다.",
        updatedAt: new Date("2026-01-02"),
      },
    ]);
    vi.mocked(mocks.folderRepo.getReadmeMentionSources).mockResolvedValue([
      {
        path: "AI",
        readme: "---\ntitle: Dependency Injection\n---\n본문에는 용어 없음",
        updatedAt: new Date("2026-01-01"),
      },
    ]);
    vi.mocked(mocks.glossaryRepo.countMentions).mockResolvedValue(1);

    const result = await createService(mocks).syncMentions({
      definitionsChanged: true,
      changedPosts: [],
      changedReadmes: [],
    });

    expect(mocks.glossaryRepo.replaceAllMentions).toHaveBeenCalledWith([
      expect.objectContaining({
        termId: "dependency-injection",
        pageType: "post",
        pagePath: "AI/intro.md",
      }),
    ]);
    expect(result).toEqual({ mentions: 1, pagesReindexed: 2 });
  });

  it("변경 page는 저장 이후 snapshot으로 교체하고 삭제 page는 정리한다", async () => {
    const mocks = makeMocks();
    vi.mocked(mocks.postRepo.getActiveMentionSource).mockResolvedValue({
      path: "AI/intro.md",
      title: "갱신된 제목",
      content: "Dependency Injection과 DI",
      updatedAt: new Date("2026-02-01"),
    });
    vi.mocked(mocks.glossaryRepo.countMentions).mockResolvedValue(4);

    const result = await createService(mocks).syncMentions({
      definitionsChanged: false,
      changedPosts: [{ path: "AI/intro.md", operation: "upsert" }],
      changedReadmes: [{ path: "AI/README.md", operation: "delete" }],
    });

    expect(mocks.glossaryRepo.replacePageMentions).toHaveBeenCalledWith(
      "post",
      "AI/intro.md",
      [
        expect.objectContaining({
          termId: "dependency-injection",
          pageTitle: "갱신된 제목",
        }),
      ],
    );
    expect(mocks.glossaryRepo.deletePageMentions).toHaveBeenCalledWith(
      "category-readme",
      "AI/README.md",
    );
    expect(result).toEqual({ mentions: 4, pagesReindexed: 2 });
  });

  it("저장 이후 사라진 upsert page도 stale mention을 삭제한다", async () => {
    const mocks = makeMocks();

    await createService(mocks).syncMentions({
      definitionsChanged: false,
      changedPosts: [{ path: "removed.md", operation: "upsert" }],
      changedReadmes: [],
    });

    expect(mocks.glossaryRepo.deletePageMentions).toHaveBeenCalledWith(
      "post",
      "removed.md",
    );
  });
});
