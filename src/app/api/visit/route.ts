import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getRepositories } from "@/db/repositories";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

function getClientIp(request: NextRequest): string {
  const visitorIp = request.headers.get("x-visitor-ip");
  if (visitorIp) return visitorIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

// POST /api/visit - 방문 기록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pagePath } = body;

    if (!pagePath || typeof pagePath !== "string") {
      return NextResponse.json(
        { error: "pagePath가 필요합니다." },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(request);
    const ipHash = hashIp(clientIp);

    const { visit } = getRepositories();
    const isNewVisit = await visit.recordVisit(pagePath, ipHash);

    return NextResponse.json({ success: true, isNewVisit });
  } catch (error) {
    console.error("방문 기록 실패:", error);
    return NextResponse.json(
      { error: "방문 기록에 실패했습니다." },
      { status: 500 }
    );
  }
}

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
    console.error("조회수 조회 실패:", error);
    return NextResponse.json(
      { error: "조회수 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
