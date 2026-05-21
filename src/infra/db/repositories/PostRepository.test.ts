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

describe("PostRepository.getAllSeries", () => {
  beforeEach(() => vi.clearAllMocks());

  const aggDate = new Date("2024-02-01T00:00:00Z");
  const aggDateOlder = new Date("2024-01-01T00:00:00Z");

  function buildAggChain(rows: unknown[]) {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.groupBy = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockResolvedValue(rows);
    chain.then = (
      onfulfilled: (v: unknown) => unknown,
      onrejected?: (e: unknown) => unknown,
    ) => Promise.resolve(rows).then(onfulfilled, onrejected);
    return chain;
  }

  function buildFirstPostChain(rows: unknown[]) {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockResolvedValue(rows);
    return chain;
  }

  function makeRepoForSeries(aggregates: unknown[], firstPosts: unknown[]) {
    const aggChain = buildAggChain(aggregates);
    const fpChain = buildFirstPostChain(firstPosts);
    let callCount = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? aggChain : fpChain;
      }),
    };
    return { repo: new PostRepository(db as unknown as DbInstance), aggChain };
  }

  it("집계 결과 없으면 빈 배열 반환", async () => {
    const { repo } = makeRepoForSeries([], []);
    const result = await repo.getAllSeries();
    expect(result).toEqual([]);
  });

  it("시리즈별 postCount + latestUpdatedAt + firstPost 반환", async () => {
    const aggregates = [
      { series: "A", postCount: "3", latestUpdatedAt: aggDate, minSeriesOrder: 1 },
    ];
    const firstPosts = [
      {
        title: "First A",
        description: "desc A",
        category: "cat",
        slug: "first-a",
        path: "cat/first-a.md",
        series: "A",
        seriesOrder: 1,
      },
    ];
    const { repo } = makeRepoForSeries(aggregates, firstPosts);
    const result = await repo.getAllSeries();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("A");
    expect(result[0].postCount).toBe(3);
    expect(result[0].latestUpdatedAt).toBe(aggDate);
    expect(result[0].firstPost.path).toBe("cat/first-a.md");
  });

  it("집계 정렬(latestUpdatedAt DESC) 순서 유지", async () => {
    const aggregates = [
      { series: "B", postCount: "2", latestUpdatedAt: aggDate, minSeriesOrder: 1 },
      { series: "A", postCount: "3", latestUpdatedAt: aggDateOlder, minSeriesOrder: 1 },
    ];
    const firstPosts = [
      {
        title: "First A",
        description: null,
        category: "cat",
        slug: "first-a",
        path: "cat/first-a.md",
        series: "A",
        seriesOrder: 1,
      },
      {
        title: "First B",
        description: null,
        category: "cat",
        slug: "first-b",
        path: "cat/first-b.md",
        series: "B",
        seriesOrder: 1,
      },
    ];
    const { repo } = makeRepoForSeries(aggregates, firstPosts);
    const result = await repo.getAllSeries();
    expect(result[0].name).toBe("B");
    expect(result[1].name).toBe("A");
  });

  it("limit 지정 시 aggChain.limit 호출", async () => {
    const aggregates = [
      { series: "A", postCount: "1", latestUpdatedAt: aggDate, minSeriesOrder: 1 },
    ];
    const firstPosts = [
      {
        title: "T",
        description: null,
        category: "cat",
        slug: "s",
        path: "cat/s.md",
        series: "A",
        seriesOrder: 1,
      },
    ];
    const { repo, aggChain } = makeRepoForSeries(aggregates, firstPosts);
    await repo.getAllSeries(1);
    expect(aggChain.limit).toHaveBeenCalledWith(1);
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
