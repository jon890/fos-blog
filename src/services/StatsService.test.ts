import { describe, expect, it, vi } from "vitest";
import type { PostRepository } from "@/infra/db/repositories/PostRepository";
import { createStatsService } from "./StatsService";

function makePostRepo(overrides: {
  getActivePostCount?: () => Promise<number>;
  getDistinctActiveCategoryCount?: () => Promise<number>;
  getLastActiveUpdatedAt?: () => Promise<Date | null>;
}) {
  return {
    getActivePostCount: overrides.getActivePostCount ?? vi.fn().mockResolvedValue(0),
    getDistinctActiveCategoryCount: overrides.getDistinctActiveCategoryCount ?? vi.fn().mockResolvedValue(0),
    getLastActiveUpdatedAt: overrides.getLastActiveUpdatedAt ?? vi.fn().mockResolvedValue(null),
  };
}

describe("StatsService.getAboutStats", () => {
  it("빈 DB일 때 기본값 반환", async () => {
    const service = createStatsService({ post: makePostRepo({}) as unknown as PostRepository });
    const stats = await service.getAboutStats();
    expect(stats).toEqual({ postCount: 0, categoryCount: 0, lastSyncAt: null });
  });

  it("정상 데이터 반환", async () => {
    const lastSync = new Date("2026-05-01T00:00:00Z");
    const post = makePostRepo({
      getActivePostCount: vi.fn().mockResolvedValue(42),
      getDistinctActiveCategoryCount: vi.fn().mockResolvedValue(7),
      getLastActiveUpdatedAt: vi.fn().mockResolvedValue(lastSync),
    });
    const service = createStatsService({ post: post as unknown as PostRepository });
    const stats = await service.getAboutStats();
    expect(stats).toEqual({ postCount: 42, categoryCount: 7, lastSyncAt: lastSync });
  });
});
