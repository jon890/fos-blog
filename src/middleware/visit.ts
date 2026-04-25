import { NextRequest, NextFetchEvent } from "next/server";
import { createHash } from "crypto";
import { getDb } from "@/infra/db";
import { VisitRepository } from "@/infra/db/repositories/VisitRepository";
import { PostRepository } from "@/infra/db/repositories/PostRepository";
import logger from "@/lib/logger";

const log = logger.child({ module: "middleware/visit" });

const SKIP_PATHS = new Set(["/posts/latest", "/posts/popular"]);
const MAX_PATH_LENGTH = 300;

/**
 * 응답 차단 없이 방문 기록을 비동기로 처리한다.
 * - `/`: 항상 기록 (`/` 자체)
 * - `/posts/...`: pathname → posts.path 변환 후 DB 존재 시에만 기록
 * - `/posts/latest|popular`: noindex 목록 페이지 — early return
 * - 길이 > 300 path: 가드 차단 (공격 페이로드 무시)
 */
export function trackVisit(request: NextRequest, event: NextFetchEvent): void {
  const pathname = request.nextUrl.pathname;

  if (pathname.length > MAX_PATH_LENGTH) return;
  if (SKIP_PATHS.has(pathname)) return;

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const visitPromise = (async () => {
    try {
      const db = getDb();
      let pagePath: string | null = null;

      if (pathname === "/") {
        pagePath = "/";
      } else if (pathname.startsWith("/posts/")) {
        const postPath = decodeURIComponent(pathname.replace("/posts/", ""));
        const postRepo = new PostRepository(db);
        const exists = await postRepo.getPostId(postPath);
        if (!exists) return;
        pagePath = postPath;
      } else {
        return;
      }

      const visitRepo = new VisitRepository(db);
      const ipHash = createHash("sha256").update(clientIp).digest("hex");
      await visitRepo.recordVisit(pagePath, ipHash);
    } catch (error) {
      log.error(
        {
          component: "middleware.visit",
          operation: "recordVisit",
          pathname,
          err: error instanceof Error ? error : new Error(String(error)),
        },
        "visit record failed"
      );
    }
  })();

  event.waitUntil(visitPromise);
}
