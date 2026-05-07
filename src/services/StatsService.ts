import type { PostRepository } from "@/infra/db/repositories/PostRepository";

export interface SiteStats {
  postCount: number;
  categoryCount: number;
  lastSyncAt: Date | null;
}

interface StatsRepositories {
  post: PostRepository;
}

export function createStatsService(repos: StatsRepositories) {
  return {
    async getAboutStats(): Promise<SiteStats> {
      const [postCount, categoryCount, lastSyncAt] = await Promise.all([
        repos.post.getActivePostCount(),
        repos.post.getDistinctActiveCategoryCount(),
        repos.post.getLastActiveUpdatedAt(),
      ]);

      return { postCount, categoryCount, lastSyncAt };
    },
  };
}
