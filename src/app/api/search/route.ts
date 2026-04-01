import { NextRequest, NextResponse } from "next/server";
import { getRepositories } from "@/infra/db/repositories";
import logger from "@/lib/logger";

const log = logger.child({ module: "app/api/search" });

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const { post } = getRepositories();
    const results = await post.searchPosts(query, limit);
    return NextResponse.json({ results });
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, "Search error");
    return NextResponse.json(
      { results: [], error: "Search failed" },
      { status: 500 }
    );
  }
}
