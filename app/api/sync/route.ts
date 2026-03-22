import { NextResponse } from "next/server";
import { syncGitHubToDatabase, retitleExistingPosts } from "@/lib/sync-github";

// 동기화 API - 수동 호출 또는 cron job에서 사용
// ?retitle=true : GitHub 호출 없이 DB content에서 h1 제목 재추출
export async function POST(request: Request) {
  // API 키 검증 (선택사항)
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env.SYNC_API_KEY;

  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const retitle = searchParams.get("retitle") === "true";

  try {
    if (retitle) {
      const result = await retitleExistingPosts();
      return NextResponse.json({
        success: true,
        message: `제목 재적용 완료: ${result.updated}개 업데이트`,
        ...result,
      });
    }

    const result = await syncGitHubToDatabase();

    return NextResponse.json({
      success: true,
      message: result.upToDate ? "Already up to date" : "Sync completed successfully",
      ...result,
    });
  } catch (error) {
    console.error("Sync error:", error);
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
