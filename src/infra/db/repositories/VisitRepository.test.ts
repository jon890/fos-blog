import { describe, expect, it, vi, beforeEach } from "vitest";
import { VisitRepository } from "./VisitRepository";
import type { DbInstance } from "./BaseRepository";

const mockLog = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    child: vi.fn().mockReturnValue(mockLog),
  },
}));

function makeDb(rows: unknown[] = []) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(rows),
  };
}

function makeDbForTotal(rows: unknown[], shouldThrow = false) {
  if (shouldThrow) {
    return {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockRejectedValue(new Error("DB error")),
    };
  }
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockResolvedValue(rows),
  };
}

describe("VisitRepository.getPopularPostPathsOffset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offset=0 일 때 상위 rows 반환", async () => {
    const rows = [{ pagePath: "/posts/a", visitCount: 10 }];
    const db = makeDb(rows);
    const repo = new VisitRepository(db as unknown as DbInstance);
    const result = await repo.getPopularPostPathsOffset({ limit: 10, offset: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("/posts/a");
    expect(result[0].visitCount).toBe(10);
  });

  it("offset=20 일 때 offset 체인 호출", async () => {
    const db = makeDb([]);
    const repo = new VisitRepository(db as unknown as DbInstance);
    await repo.getPopularPostPathsOffset({ limit: 10, offset: 20 });
    expect(db.offset).toHaveBeenCalledWith(20);
  });
});

describe("VisitRepository.getPopularPostPathsTotal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("합계 숫자 반환", async () => {
    const db = makeDbForTotal([{ total: "42" }]);
    const repo = new VisitRepository(db as unknown as DbInstance);
    const total = await repo.getPopularPostPathsTotal();
    expect(total).toBe(42);
  });

  it("DB 에러 시 throw", async () => {
    const db = makeDbForTotal([], true);
    const repo = new VisitRepository(db as unknown as DbInstance);
    await expect(repo.getPopularPostPathsTotal()).rejects.toThrow("DB error");
  });

  it("DB 에러 시 logger.error 호출 (구조화 4-field)", async () => {
    const db = makeDbForTotal([], true);
    const repo = new VisitRepository(db as unknown as DbInstance);
    await expect(repo.getPopularPostPathsTotal()).rejects.toThrow();
    expect(mockLog.error).toHaveBeenCalledWith(
      expect.objectContaining({
        component: "repo.visit",
        operation: "getPopularPostPathsTotal",
        err: expect.any(Error),
      }),
      expect.any(String)
    );
  });
});
