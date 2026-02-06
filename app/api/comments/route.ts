import { NextRequest, NextResponse } from "next/server";
import { getDbQueries } from "@/db/queries";

// GET /api/comments?slug=xxx - 댓글 목록 조회
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json(
      { error: "slug 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const dbQueries = getDbQueries();
    if (!dbQueries) {
      return NextResponse.json(
        { error: "데이터베이스에 연결할 수 없습니다." },
        { status: 503 }
      );
    }

    const comments = await dbQueries.getCommentsByPostSlug(slug);
    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Failed to get comments:", error);
    return NextResponse.json(
      { error: "댓글을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST /api/comments - 댓글 작성
export async function POST(request: NextRequest) {
  try {
    const dbQueries = getDbQueries();
    if (!dbQueries) {
      return NextResponse.json(
        { error: "데이터베이스에 연결할 수 없습니다." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { postSlug, nickname, password, content } = body;

    // 유효성 검사
    if (!postSlug || !nickname || !password || !content) {
      return NextResponse.json(
        { error: "모든 필드를 입력해주세요." },
        { status: 400 }
      );
    }

    if (nickname.length > 100) {
      return NextResponse.json(
        { error: "닉네임은 100자 이하로 입력해주세요." },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "비밀번호는 4자 이상 입력해주세요." },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: "댓글은 5000자 이하로 입력해주세요." },
        { status: 400 }
      );
    }

    const comment = await dbQueries.createComment({
      postSlug,
      nickname,
      password,
      content,
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Failed to create comment:", error);
    return NextResponse.json(
      { error: "댓글 작성에 실패했습니다." },
      { status: 500 }
    );
  }
}
