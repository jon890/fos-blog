import { NextResponse, NextRequest, NextFetchEvent } from "next/server";

/**
 * 페이지 방문 시 자동으로 방문 기록 API를 호출하는 미들웨어
 * waitUntil을 사용하여 응답을 지연시키지 않고 비동기로 처리
 */
export function middleware(request: NextRequest, event: NextFetchEvent) {
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

  // fire-and-forget 방식으로 방문 기록
  const origin = request.nextUrl.origin;
  const visitPromise = fetch(`${origin}/api/visit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-visitor-ip": clientIp, // 원본 IP를 커스텀 헤더로 전달
    },
    body: JSON.stringify({ pagePath }),
  }).catch(() => {
    // 방문 기록 실패해도 페이지 응답에 영향 없음
  });

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
