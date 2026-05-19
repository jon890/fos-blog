import { describe, expect, it, vi, beforeEach } from "vitest";
import { PostRepository, tagIntersectionSize } from "./PostRepository";
import type { DbInstance } from "./BaseRepository";

function makeDb(rows: unknown[] = []) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

function makeRepo(rows: unknown[] = []) {
  const db = makeDb(rows);
  return { repo: new PostRepository(db as unknown as DbInstance), db };
}

const now = new Date("2024-01-10T00:00:00Z");
const earlier = new Date("2024-01-09T00:00:00Z");

const baseRow = {
  title: "Post A",
  path: "cat/post-a.md",
  slug: "post-a",
  category: "cat",
  subcategory: null,
  folders: ["cat"],
  description: "desc",
  updatedAt: now,
  id: 42,
};

describe("PostRepository.getRecentPostsCursor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cursor 없을 때 상위 rows 반환", async () => {
    const { repo } = makeRepo([baseRow]);
    const result = await repo.getRecentPostsCursor({ limit: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("cat/post-a.md");
  });

  it("cursor 있을 때 호출 성공 (WHERE 조건 포함)", async () => {
    const { repo, db } = makeRepo([]);
    await repo.getRecentPostsCursor({
      limit: 10,
      cursor: { updatedAt: earlier, id: 10 },
    });
    expect(db.where).toHaveBeenCalled();
  });

  it("is_active 필터 - isActive=false 행 제외 (where 호출 확인)", async () => {
    const { repo, db } = makeRepo([]);
    await repo.getRecentPostsCursor({ limit: 10 });
    expect(db.where).toHaveBeenCalled();
  });

  it("반환 객체에 updatedAt(Date)과 id(number) 필드 존재", async () => {
    const { repo } = makeRepo([baseRow]);
    const result = await repo.getRecentPostsCursor({ limit: 10 });
    expect(result[0].updatedAt).toBeInstanceOf(Date);
    expect(typeof result[0].id).toBe("number");
  });

  it("folders null → 빈 배열로 치환", async () => {
    const row = { ...baseRow, folders: null };
    const { repo } = makeRepo([row]);
    const result = await repo.getRecentPostsCursor({ limit: 10 });
    expect(result[0].folders).toEqual([]);
  });
});

describe("tagIntersectionSize", () => {
  it("양쪽 빈 배열 → 0", () => {
    expect(tagIntersectionSize([], [])).toBe(0);
  });

  it("한쪽만 빈 배열 → 0", () => {
    expect(tagIntersectionSize(["a"], [])).toBe(0);
    expect(tagIntersectionSize([], ["a"])).toBe(0);
  });

  it("교집합 0 → 0", () => {
    expect(tagIntersectionSize(["a", "b"], ["c", "d"])).toBe(0);
  });

  it("교집합 1", () => {
    expect(tagIntersectionSize(["a", "b"], ["b", "c"])).toBe(1);
  });

  it("교집합 n (전체 일치)", () => {
    expect(tagIntersectionSize(["a", "b", "c"], ["a", "b", "c"])).toBe(3);
  });

  it("대소문자 정규화 (대소문자 다른 같은 태그 → 교집합 1)", () => {
    expect(tagIntersectionSize(["React"], ["react"])).toBe(1);
    expect(tagIntersectionSize(["TypeScript", "Next.js"], ["typescript", "NEXT.JS"])).toBe(2);
  });

  it("b 안의 중복은 a 와 매칭될 때마다 카운트 (현재 구현 동작 명세)", () => {
    expect(tagIntersectionSize(["a"], ["a", "a"])).toBe(2);
  });
});
