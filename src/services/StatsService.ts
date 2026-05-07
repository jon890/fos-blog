import { getRepositories } from "@/infra/db/repositories";

export interface SiteStats {
  postCount: number;
  categoryCount: number;
  lastSyncAt: Date | null;
}

interface StatsPostRepository {
  getActivePostCount(): Promise<number>;
  getDistinctActiveCategoryCount(): Promise<number>;
  getLastActiveUpdatedAt(): Promise<Date | null>;
}

interface StatsRepositories {
  post: StatsPostRepository;
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

export function createDefaultStatsService() {
  return createStatsService(getRepositories());
}
