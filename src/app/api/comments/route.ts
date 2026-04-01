import { NextRequest, NextResponse } from "next/server";
import { getRepositories } from "@/infra/db/repositories";
import logger from "@/lib/logger";

const log = logger.child({ module: "app/api/comments" });

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
    const { comment } = getRepositories();
    const comments = await comment.getCommentsByPostSlug(slug);
    return NextResponse.json({ comments });
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, "Failed to get comments");
    return NextResponse.json(
      { error: "댓글을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST /api/comments - 댓글 작성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postSlug, nickname, password, content } = body;

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

    const { comment } = getRepositories();
    const createdComment = await comment.createComment({
      postSlug,
      nickname,
      password,
      content,
    });

    return NextResponse.json({ comment: createdComment }, { status: 201 });
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, "Failed to create comment");
    return NextResponse.json(
      { error: "댓글 작성에 실패했습니다." },
      { status: 500 }
    );
  }
}
