import { getRepositories } from "@/infra/db/repositories";
import logger from "@/lib/logger";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { PostsInfiniteList, type PostItem } from "@/components/PostsInfiniteList";
import { BackToTopButton } from "@/components/BackToTopButton";

const log = logger.child({ module: "app/posts/latest/page" });

const INITIAL_LIMIT = DEFAULT_PAGE_SIZE;

export const revalidate = 60;

export const metadata = {
  title: "최신 글 — FOS Study",
  description: "개발 공부 기록 블로그의 최신 글 목록입니다.",
  robots: { index: false, follow: true },
};

export default async function PostsLatestPage() {
  let initialItems: PostItem[] = [];
  let initialNextCursor: string | null = null;

  try {
    const { post, visit } = getRepositories();
    const rows = await post.getRecentPostsCursor({ limit: INITIAL_LIMIT });
    const paths = rows.map((r) => r.path);
    const visitCounts = paths.length > 0 ? await visit.getPostVisitCounts(paths) : {};

    const last = rows[rows.length - 1];
    initialNextCursor =
      rows.length === INITIAL_LIMIT && last
        ? `${last.updatedAt.toISOString()}:${last.id}`
        : null;

    initialItems = rows.map(({ updatedAt: _u, id: _i, ...rest }) => ({
      ...rest,
      visitCount: visitCounts[rest.path] ?? 0,
    }));
  } catch (error) {
    log.warn(
      { err: error instanceof Error ? error : new Error(String(error)) },
      "Database not available"
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          최신 글
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">업데이트 순</p>
      </div>

      <PostsInfiniteList
        mode="latest"
        initialItems={initialItems}
        initialNextCursor={initialNextCursor}
      />

      <BackToTopButton variant="floating" />
    </div>
  );
}
