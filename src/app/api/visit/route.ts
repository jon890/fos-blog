import { NextRequest, NextResponse } from "next/server";
import { getRepositories } from "@/infra/db/repositories";
import logger from "@/lib/logger";

const log = logger.child({ module: "app/api/visit" });

// 방문 기록은 proxy.ts 미들웨어에서 처리됨

// GET /api/visit - 조회수 조회
export async function GET(request: NextRequest) {
  try {
    const { visit } = getRepositories();
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get("path");
    const paths = searchParams.get("paths");
    const total = searchParams.get("total");

    if (total === "true") {
      const [totalCount, todayCount] = await Promise.all([
        visit.getTotalVisitCount(),
        visit.getTodayVisitorCount(),
      ]);
      return NextResponse.json({ totalCount, todayCount });
    }

    if (paths) {
      const pathList = paths.split(",").map((p) => p.trim());
      const counts = await visit.getPostVisitCounts(pathList);
      return NextResponse.json({ counts });
    }

    if (path) {
      const count = await visit.getVisitCount(path);
      return NextResponse.json({ count });
    }

    const totalCount = await visit.getTotalVisitCount();
    return NextResponse.json({ totalCount });
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, "조회수 조회 실패");
    return NextResponse.json(
      { error: "조회수 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
