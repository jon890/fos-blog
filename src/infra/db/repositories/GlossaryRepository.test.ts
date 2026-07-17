import { describe, expect, it, vi } from "vitest";
import type { DbInstance } from "./BaseRepository";
import { GlossaryRepository } from "./GlossaryRepository";

function makeRepository() {
  const where = vi.fn().mockResolvedValue(undefined);
  const deleteFrom = vi.fn(() => ({ where }));
  const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onDuplicateKeyUpdate }));
  const insert = vi.fn(() => ({ values }));
  const tx = { delete: deleteFrom, insert };
  const transaction = vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) => {
    await callback(tx);
  });
  const db = { transaction } as unknown as DbInstance;

  return {
    repo: new GlossaryRepository(db),
    transaction,
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
    expect(mocks.values).toHaveBeenCalledWith([term]);
    expect(mocks.onDuplicateKeyUpdate).toHaveBeenCalledOnce();
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
