import { NextResponse } from "next/server";
import { syncGitHubToDatabase, retitleExistingPosts } from "@/lib/sync-github";
import logger from "@/lib/logger";

const log = logger.child({ module: "api/sync" });

// 동기화 API - 수동 호출 또는 cron job에서 사용
// 파일 동기화 + 제목 재추출을 항상 함께 수행
export async function POST(request: Request) {
  // API 키 검증 (선택사항)
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env.SYNC_API_KEY;

  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const syncResult = await syncGitHubToDatabase();
    const retitleResult = await retitleExistingPosts();

    return NextResponse.json({
      success: true,
      message: syncResult.upToDate ? "Already up to date" : "Sync completed successfully",
      commitSha: syncResult.commitSha,
      files: {
        added: syncResult.added,
        updated: syncResult.updated,
        deleted: syncResult.deleted,
      },
      titles: {
        updated: retitleResult.updated,
        skipped: retitleResult.skipped,
        total: retitleResult.total,
      },
    });
  } catch (error) {
    log.error({ err: error }, "Sync error");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET 요청으로도 동기화 가능 (개발 편의성)
export async function GET(request: Request) {
  return POST(request);
}
