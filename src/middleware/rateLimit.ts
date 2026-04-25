import { NextRequest, NextResponse } from "next/server";

/**
 * Rate limiting placeholder. 실제 구현은 plan007 에서.
 * 현재는 모든 요청 통과 (no-op).
 */
export function rateLimit(_request: NextRequest): NextResponse | null {
  return null; // null = 통과, NextResponse = 차단
}
