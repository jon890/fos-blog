import { NextResponse, NextRequest, NextFetchEvent } from "next/server";
import { createHash } from "crypto";
import { getDbQueries } from "@/db/queries";

/**
 * 페이지 방문 시 직접 DB에 방문 기록을 남기는 프록시
 * waitUntil을 사용하여 응답을 지연시키지 않고 비동기로 처리
 */
export function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;

  // 클라이언트 IP 추출
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // 포스트 상세 페이지의 경우 slug를 pagePath로 사용
  let pagePath = pathname;
  if (pathname.startsWith("/posts/")) {
    // /posts/category/file.md -> category/file.md
    pagePath = decodeURIComponent(pathname.replace("/posts/", ""));
  }

  // fire-and-forget 방식으로 직접 DB에 방문 기록
  const visitPromise = (async () => {
    try {
      const dbQueries = getDbQueries();
      if (!dbQueries) return;

      const ipHash = createHash("sha256").update(clientIp).digest("hex");
      await dbQueries.recordVisit(pagePath, ipHash);
    } catch (error) {
      console.error("[proxy] 방문 기록 실패:", error);
    }
  })();

  event.waitUntil(visitPromise);

  return NextResponse.next();
}

export const config = {
  matcher: [
    // 메인 페이지
    "/",
    // 포스트 상세 페이지
    "/posts/:path*",
  ],
};
