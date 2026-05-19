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

export type RSSPostDataLite = Pick<
  PostData,
  | "title"
  | "path"
  | "slug"
  | "category"
  | "subcategory"
  | "folders"
  | "description"
  | "createdAt"
>;

interface RSSPostRepository {
  getRecentActive(args: { limit?: number }): Promise<RSSPostData[]>;
  getRecentActiveLite(args: { limit?: number }): Promise<RSSPostDataLite[]>;
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
    async getRecentForFeedLite({
      limit = 50,
    }: { limit?: number } = {}): Promise<RSSPostDataLite[]> {
      return repos.post.getRecentActiveLite({ limit });
    },
  };
}

export function createDefaultRSSService() {
  return createRSSService(getRepositories());
}
