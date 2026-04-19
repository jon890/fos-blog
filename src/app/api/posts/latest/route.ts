import { NextResponse } from "next/server";
import { getRepositories } from "@/infra/db/repositories";
import { clampPageLimit } from "@/lib/pagination";
import logger from "@/lib/logger";

const log = logger.child({ module: "api/posts/latest" });

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limit = clampPageLimit(url.searchParams.get("limit"));
  const cursorParam = url.searchParams.get("cursor");

  let cursor: { updatedAt: Date; id: number } | undefined;
  if (cursorParam) {
    const idx = cursorParam.lastIndexOf(":");
    if (idx === -1) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    const isoStr = cursorParam.slice(0, idx);
    const idStr = cursorParam.slice(idx + 1);
    const updatedAt = new Date(isoStr);
    const id = parseInt(idStr, 10);
    if (isNaN(updatedAt.getTime()) || isNaN(id)) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    cursor = { updatedAt, id };
  }

  try {
    const { post, visit } = getRepositories();
    const rows = await post.getRecentPostsCursor({ limit, cursor });
    const paths = rows.map((r) => r.path);
    const visitCounts = await visit.getPostVisitCounts(paths);

    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === limit && last
        ? `${last.updatedAt.toISOString()}:${last.id}`
        : null;

    const items = rows.map(({ updatedAt: _u, id: _i, ...rest }) => ({
      ...rest,
      visitCount: visitCounts[rest.path] ?? 0,
    }));

    return NextResponse.json({ items, nextCursor });
  } catch (error) {
    log.error(
      {
        component: "api.posts.latest",
        operation: "GET",
        err: error instanceof Error ? error : new Error(String(error)),
      },
      "Failed to fetch latest posts"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
