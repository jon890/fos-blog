import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";

const log = logger.child({ module: "middleware/rateLimit" });

export const WINDOW_MS = 60_000; // 1분
export const MAX_REQUESTS_PER_WINDOW = 1000;
export const MAX_BUCKETS = 10_000;
// NaverBot 은 현재 Yeti UA 만 사용하지만, Naver 가 향후 별도 봇명을 도입할 가능성 대비 future-proofing 으로 유지
const BOT_UA_PATTERN = /Googlebot|Bingbot|NaverBot|Yeti/i;

/**
 * IPv4 또는 IPv6 의 localhost / RFC1918 사설 대역 / IPv6 ULA 여부.
 *
 * 우회 대상:
 * - localhost: 127.x.x.x, ::1, ::ffff:127.x.x.x, "localhost"
 * - RFC1918: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
 * - RFC1918 IPv4-mapped IPv6: ::ffff:10.x.x.x, ::ffff:192.168.x.x, ::ffff:172.16-31.x.x
 * - IPv6 ULA: fc00::/7 (fc.. 또는 fd..)
 */
export function isLocalOrPrivateIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase();
  if (ip === "" || ip === "unknown" || ip === "localhost") return true;
  if (ip === "::1") return true;

  // IPv4-mapped IPv6 → IPv4 부분만 추출
  const v4 = ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;

  // IPv4 인지 확인
  const v4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v4);
  if (v4Match) {
    const a = Number(v4Match[1]);
    const b = Number(v4Match[2]);
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    return false;
  }

  // IPv6 ULA fc00::/7 — 첫 바이트 fc 또는 fd
  if (/^f[cd][0-9a-f]{2}:/.test(ip)) return true;

  return false;
}

interface Bucket {
  windowKey: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

/**
 * 클라이언트 IP 추출. x-real-ip 우선, x-forwarded-for fallback.
 *
 * x-real-ip 우선 이유: nginx 가 직접 주입하는 헤더라 클라이언트 위조 불가.
 * x-forwarded-for 는 chain 형태 (클라이언트가 임의 prefix 삽입 가능) → spoofing 위험.
 * 공격자가 RFC1918 IP (192.168.x.x 등) 로 헤더를 위조해 isLocalOrPrivateIp 우회 시도 차단.
 *
 * dev 환경 (nginx 없음) 에선 둘 다 부재 → "unknown" 으로 fail-open (의도 동작).
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
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
 * - Googlebot|Bingbot|NaverBot|Yeti UA + localhost/RFC1918/IPv6 ULA 는 예외
 * - 초과 시 429 + Retry-After
 * - 통과 시 null 반환 (proxy.ts orchestrator 가 통과 처리)
 */
export function rateLimit(request: NextRequest): NextResponse | null {
  if (isAllowedBot(request)) return null;

  const ip = getClientIp(request);
  if (isLocalOrPrivateIp(ip)) return null;

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
