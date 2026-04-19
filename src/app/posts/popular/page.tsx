import { getRepositories } from "@/infra/db/repositories";
import logger from "@/lib/logger";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { PostsInfiniteList, type PostItem } from "@/components/PostsInfiniteList";
import { BackToTopButton } from "@/components/BackToTopButton";
import { Flame } from "lucide-react";

const log = logger.child({ module: "app/posts/popular/page" });

const INITIAL_LIMIT = DEFAULT_PAGE_SIZE;

export const revalidate = 600;

export const metadata = {
  title: "인기 글 — FOS Study",
  description: "개발 공부 기록 블로그의 방문수 기준 인기 글 목록입니다.",
  robots: { index: false, follow: true },
};

export default async function PostsPopularPage() {
  let initialItems: PostItem[] = [];
  let initialOffset = 0;
  let initialHasMore = false;

  try {
    const { post, visit } = getRepositories();
    const [pathRows, total] = await Promise.all([
      visit.getPopularPostPathsOffset({ limit: INITIAL_LIMIT, offset: 0 }),
      visit.getPopularPostPathsTotal(),
    ]);

    const paths = pathRows.map((r) => r.path);
    const postDataList = await post.getPostsByPaths(paths);

    const postMap = new Map(postDataList.map((p) => [p.path, p]));
    const visitCountMap = new Map(pathRows.map((r) => [r.path, r.visitCount]));

    initialItems = paths
      .map((path) => {
        const postData = postMap.get(path);
        if (!postData) return null;
        return { ...postData, visitCount: visitCountMap.get(path) ?? 0 };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    initialOffset = pathRows.length;
    initialHasMore = pathRows.length < total;
  } catch (error) {
    log.warn(
      { err: error instanceof Error ? error : new Error(String(error)) },
      "Database not available"
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8 flex items-center gap-2">
        <Flame className="w-7 h-7 text-orange-500" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            인기 글
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">방문수 순</p>
        </div>
      </div>

      <PostsInfiniteList
        mode="popular"
        initialItems={initialItems}
        initialOffset={initialOffset}
        initialHasMore={initialHasMore}
      />

      <BackToTopButton variant="floating" />
    </div>
  );
}
