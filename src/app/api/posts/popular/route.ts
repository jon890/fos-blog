import { NextResponse } from "next/server";
import { getRepositories } from "@/infra/db/repositories";
import logger from "@/lib/logger";

const log = logger.child({ module: "api/posts/popular" });

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get("limit") ?? "10", 10);
  const limit = Math.min(30, Math.max(1, isNaN(limitParam) ? 10 : limitParam));
  const offsetParam = parseInt(url.searchParams.get("offset") ?? "0", 10);

  if (isNaN(offsetParam) || offsetParam < 0) {
    return NextResponse.json({ error: "Invalid offset" }, { status: 400 });
  }

  try {
    const { post, visit } = getRepositories();
    const [popularPaths, total] = await Promise.all([
      visit.getPopularPostPathsOffset({ limit, offset: offsetParam }),
      visit.getPopularPostPathsTotal(),
    ]);

    const paths = popularPaths.map((r) => r.path);
    const postDataList = await post.getPostsByPaths(paths);

    const postMap = new Map(postDataList.map((p) => [p.path, p]));
    const visitCountMap = new Map(popularPaths.map((r) => [r.path, r.visitCount]));

    const items = paths
      .map((path) => {
        const postData = postMap.get(path);
        if (!postData) return null;
        return { ...postData, visitCount: visitCountMap.get(path) ?? 0 };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const nextOffset = offsetParam + popularPaths.length;
    const hasMore = nextOffset < total;

    return NextResponse.json({ items, hasMore, nextOffset });
  } catch (error) {
    log.error(
      {
        component: "api.posts.popular",
        operation: "GET",
        err: error instanceof Error ? error : new Error(String(error)),
      },
      "Failed to fetch popular posts"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
