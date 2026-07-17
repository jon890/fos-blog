import { describe, expect, it, vi } from "vitest";
import {
  GlossaryRepository,
  type GlossaryRepositoryDb,
} from "./GlossaryRepository";

function makeRepository() {
  const where = vi.fn().mockResolvedValue(undefined);
  const deleteFrom = vi.fn(() => ({ where }));
  const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onDuplicateKeyUpdate }));
  const insert = vi.fn(() => ({ values }));
  type Transaction = Parameters<
    Parameters<GlossaryRepositoryDb["transaction"]>[0]
  >[0];
  const tx: Transaction = Object.assign(Object.create(null), {
    delete: deleteFrom,
    insert,
  });
  const transactionSpy = vi.fn();
  const transaction: GlossaryRepositoryDb["transaction"] = async <T>(
    callback: (transaction: Transaction) => Promise<T>,
  ): Promise<T> => {
    transactionSpy();
    return callback(tx);
  };
  const unsupportedDelete: GlossaryRepositoryDb["delete"] = () => {
    throw new Error("이 테스트에서는 direct delete를 사용하지 않습니다.");
  };
  const unsupportedSelect: GlossaryRepositoryDb["select"] = () => {
    throw new Error("이 테스트에서는 select를 사용하지 않습니다.");
  };
  const db: GlossaryRepositoryDb = {
    delete: unsupportedDelete,
    select: unsupportedSelect,
    transaction,
  };

  return {
    repo: new GlossaryRepository(db),
    transaction: transactionSpy,
    deleteFrom,
    where,
    insert,
    values,
    onDuplicateKeyUpdate,
  };
}

const term = {
  id: "dependency-injection",
  term: "Dependency Injection",
  fullName: null,
  aliases: ["DI"],
  summary: "의존성을 외부에서 전달하는 설계 방식",
  description: "객체 생성과 사용을 분리합니다.",
  caseSensitive: false,
  references: [],
};

describe("GlossaryRepository.replaceTerms", () => {
  it("upsert와 원본에 없는 정의 삭제를 한 transaction에서 수행한다", async () => {
    const mocks = makeRepository();

    await mocks.repo.replaceTerms([term]);

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.values).toHaveBeenCalledWith(term);
    expect(mocks.onDuplicateKeyUpdate).toHaveBeenCalledOnce();
    expect(mocks.onDuplicateKeyUpdate).toHaveBeenCalledWith({
      set: {
        term: term.term,
        fullName: term.fullName,
        aliases: term.aliases,
        summary: term.summary,
        description: term.description,
        caseSensitive: term.caseSensitive,
        references: term.references,
      },
    });
    expect(mocks.deleteFrom).toHaveBeenCalledOnce();
    expect(mocks.where).toHaveBeenCalledOnce();
    expect(mocks.deleteFrom.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.insert.mock.invocationCallOrder[0],
    );
  });

  it("빈 배열은 notInArray 없이 전체 삭제한다", async () => {
    const mocks = makeRepository();

    await mocks.repo.replaceTerms([]);

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.deleteFrom).toHaveBeenCalledOnce();
    expect(mocks.where).not.toHaveBeenCalled();
  });
});

describe("GlossaryRepository.getMatchableTerms", () => {
  it("tooltip 표시에 필요한 fullName을 projection에 포함한다", async () => {
    const rows = [
      {
        id: "llm",
        term: "LLM",
        fullName: "Large Language Model",
        aliases: [],
        summary: "대규모 언어 모델",
        caseSensitive: false,
      },
    ];
    const from = vi.fn().mockResolvedValue(rows);
    const selectBuilder = Object.assign(Object.create(null), { from });
    const selectSpy = vi.fn();
    const select: GlossaryRepositoryDb["select"] = (
      projection?: Record<string, unknown>,
    ) => {
      selectSpy(projection);
      return selectBuilder;
    };
    const unsupportedDelete: GlossaryRepositoryDb["delete"] = () => {
      throw new Error("이 테스트에서는 delete를 사용하지 않습니다.");
    };
    const unsupportedTransaction: GlossaryRepositoryDb["transaction"] =
      async () => {
        throw new Error("이 테스트에서는 transaction을 사용하지 않습니다.");
      };
    const db: GlossaryRepositoryDb = {
      delete: unsupportedDelete,
      select,
      transaction: unsupportedTransaction,
    };
    const repo = new GlossaryRepository(db);

    await expect(repo.getMatchableTerms()).resolves.toEqual(rows);
    expect(selectSpy).toHaveBeenCalledOnce();
    expect(Object.keys(selectSpy.mock.calls[0][0])).toContain("fullName");
  });
});

describe("GlossaryRepository mention writes", () => {
  const mention = {
    termId: "dependency-injection",
    pageTitle: "DI 소개",
    pageUpdatedAt: new Date("2026-01-01"),
  };

  it("전체 교체는 한 transaction에서 기존 row를 지운 뒤 insert한다", async () => {
    const mocks = makeRepository();

    await mocks.repo.replaceAllMentions([
      { ...mention, pageType: "post", pagePath: "AI/intro.md" },
    ]);

    expect(mocks.deleteFrom).toHaveBeenCalledOnce();
    expect(mocks.where).not.toHaveBeenCalled();
    expect(mocks.values).toHaveBeenCalledWith([
      { ...mention, pageType: "post", pagePath: "AI/intro.md" },
    ]);
    expect(mocks.deleteFrom.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.insert.mock.invocationCallOrder[0],
    );
  });

  it("page 교체의 빈 배열은 delete만 수행한다", async () => {
    const mocks = makeRepository();

    await mocks.repo.replacePageMentions("post", "AI/intro.md", []);

    expect(mocks.where).toHaveBeenCalledOnce();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
