import { getRepositories } from "@/infra/db/repositories";
import type { PostData } from "@/infra/db/types";

export type RSSPostData = Pick<
  PostData,
  | "title"
  | "path"
  | "slug"
  | "category"
  | "subcategory"
  | "folders"
  | "description"
  | "content"
  | "createdAt"
>;

interface RSSPostRepository {
  getRecentActive(args: { limit?: number }): Promise<RSSPostData[]>;
}

interface RSSRepositories {
  post: RSSPostRepository;
}

export function createRSSService(repos: RSSRepositories) {
  return {
    async getRecentForFeed({ limit = 50 }: { limit?: number } = {}): Promise<
      RSSPostData[]
    > {
      return repos.post.getRecentActive({ limit });
    },
  };
}

export function createDefaultRSSService() {
  return createRSSService(getRepositories());
}
