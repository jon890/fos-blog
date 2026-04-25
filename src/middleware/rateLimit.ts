import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";

const log = logger.child({ module: "middleware/rateLimit" });

const WINDOW_MS = 60_000; // 1분
const MAX_REQUESTS_PER_WINDOW = 60;
const MAX_BUCKETS = 10_000;
const BOT_UA_PATTERN = /Googlebot/i;
const LOCALHOST_IPS = new Set(["127.0.0.1", "::1"]);

interface Bucket {
  windowKey: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isAllowedBot(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  return BOT_UA_PATTERN.test(ua);
}

/**
 * MAX_BUCKETS 초과 시 현재 windowKey 와 다른 만료된 entry 일괄 제거.
 * 활성 IP(현재 윈도우) 카운트는 보존.
 */
function sweepExpiredBuckets(currentWindowKey: number): void {
  for (const [ip, bucket] of buckets) {
    if (bucket.windowKey !== currentWindowKey) {
      buckets.delete(ip);
    }
  }
}

/**
 * Fixed window 60초/IP rate limit.
 * - Googlebot UA + localhost(127.0.0.1/::1) 는 예외 (cron 자기 호출 보호)
 * - 초과 시 429 + Retry-After
 * - 통과 시 null 반환 (proxy.ts orchestrator 가 통과 처리)
 */
export function rateLimit(request: NextRequest): NextResponse | null {
  if (isAllowedBot(request)) return null;

  const ip = getClientIp(request);
  if (ip === "unknown" || LOCALHOST_IPS.has(ip)) return null;

  const now = Date.now();
  const windowKey = Math.floor(now / WINDOW_MS);
  const bucket = buckets.get(ip);

  if (!bucket || bucket.windowKey !== windowKey) {
    if (buckets.size >= MAX_BUCKETS) sweepExpiredBuckets(windowKey);
    buckets.set(ip, { windowKey, count: 1 });
    return null;
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    log.warn(
      {
        component: "middleware.rateLimit",
        operation: "block",
        ip,
        path: request.nextUrl.pathname,
      },
      "rate limit exceeded"
    );
    const retryAfterSeconds = Math.ceil(
      ((windowKey + 1) * WINDOW_MS - now) / 1000
    );
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfterSeconds)),
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  bucket.count += 1;
  return null;
}
