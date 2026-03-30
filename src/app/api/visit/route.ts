import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getDbQueries } from "@/db/queries";

/**
 * IP 주소를 SHA-256으로 해싱 (개인정보 보호)
 */
function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * 요청에서 클라이언트 IP 추출
 * 미들웨어에서 전달한 x-visitor-ip 헤더를 우선 사용
 */
function getClientIp(request: NextRequest): string {
  // 미들웨어에서 전달한 원본 IP
  const visitorIp = request.headers.get("x-visitor-ip");
  if (visitorIp) {
    return visitorIp;
  }

  // Vercel / 프록시 환경에서의 IP 추출
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

/**
 * POST /api/visit - 방문 기록
 * Body: { pagePath: string }
 */
export async function POST(request: NextRequest) {
  try {
    const dbQueries = getDbQueries();
    if (!dbQueries) {
      return NextResponse.json(
        { error: "데이터베이스 연결 실패" },
        { status: 503 }
      );
    }

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

    const isNewVisit = await dbQueries.recordVisit(pagePath, ipHash);

    return NextResponse.json({ success: true, isNewVisit });
  } catch (error) {
    console.error("방문 기록 실패:", error);
    return NextResponse.json(
      { error: "방문 기록에 실패했습니다." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/visit - 조회수 조회
 * Query params:
 *   - path: 특정 페이지 조회수 (없으면 전체)
 *   - paths: 여러 페이지 조회수 (콤마 구분)
 *   - total: "true"이면 전체 방문자 수 반환
 */
export async function GET(request: NextRequest) {
  try {
    const dbQueries = getDbQueries();
    if (!dbQueries) {
      return NextResponse.json(
        { error: "데이터베이스 연결 실패" },
        { status: 503 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get("path");
    const paths = searchParams.get("paths");
    const total = searchParams.get("total");

    // 전체 방문자 수 + 오늘 방문자 수
    if (total === "true") {
      const [totalCount, todayCount] = await Promise.all([
        dbQueries.getTotalVisitCount(),
        dbQueries.getTodayVisitorCount(),
      ]);
      return NextResponse.json({ totalCount, todayCount });
    }

    // 여러 페이지의 조회수
    if (paths) {
      const pathList = paths.split(",").map((p) => p.trim());
      const counts = await dbQueries.getPostVisitCounts(pathList);
      return NextResponse.json({ counts });
    }

    // 특정 페이지 조회수
    if (path) {
      const count = await dbQueries.getVisitCount(path);
      return NextResponse.json({ count });
    }

    // 파라미터 없으면 전체 방문자 수
    const totalCount = await dbQueries.getTotalVisitCount();
    return NextResponse.json({ totalCount });
  } catch (error) {
    console.error("조회수 조회 실패:", error);
    return NextResponse.json(
      { error: "조회수 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
