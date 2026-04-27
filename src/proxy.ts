import { NextRequest, NextFetchEvent, NextResponse } from "next/server";
import { trackVisit } from "@/middleware/visit";
import { rateLimit } from "@/middleware/rateLimit";

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const limitResponse = rateLimit(request);
  if (limitResponse) return limitResponse;

  trackVisit(request, event);

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/posts/:path*",
    "/((?!_next/static|_next/image|_next/data|api/|favicon|logo|og-default|fonts/|sitemap\\.xml|robots\\.txt|ads\\.txt|manifest\\.json|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|css|js|map)$).*)",
  ],
};
