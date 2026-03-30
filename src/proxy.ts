import { NextResponse, NextRequest, NextFetchEvent } from "next/server";
import { createHash } from "crypto";
import { getDb } from "@/db";
import { VisitRepository } from "@/db/repositories";

/**
 * 페이지 방문 시 직접 DB에 방문 기록을 남기는 프록시
 * waitUntil을 사용하여 응답을 지연시키지 않고 비동기로 처리
 */
export function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  let pagePath = pathname;
  if (pathname.startsWith("/posts/")) {
    pagePath = decodeURIComponent(pathname.replace("/posts/", ""));
  }

  const visitPromise = (async () => {
    try {
      const db = getDb();
      const visitRepo = new VisitRepository(db);
      const ipHash = createHash("sha256").update(clientIp).digest("hex");
      await visitRepo.recordVisit(pagePath, ipHash);
    } catch (error) {
      console.error("[proxy] 방문 기록 실패:", error);
    }
  })();

  event.waitUntil(visitPromise);

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/posts/:path*",
  ],
};
