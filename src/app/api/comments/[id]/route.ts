import { NextRequest, NextResponse } from "next/server";
import { getRepositories } from "@/infra/db/repositories";
import logger from "@/lib/logger";

const log = logger.child({ module: "app/api/comments/[id]" });

type RouteParams = {
  params: Promise<{ id: string }>;
};

// PUT /api/comments/[id] - 댓글 수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const commentId = parseInt(id, 10);

    if (isNaN(commentId)) {
      return NextResponse.json(
        { error: "유효하지 않은 댓글 ID입니다." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { password, content } = body;

    if (!password || !content) {
      return NextResponse.json(
        { error: "비밀번호와 내용을 입력해주세요." },
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
    const updatedComment = await comment.updateComment(commentId, password, content);

    if (!updatedComment) {
      return NextResponse.json(
        { code: "NOT_FOUND", error: "댓글을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ comment: updatedComment });
  } catch (error) {
    if (error instanceof Error && error.message === "비밀번호가 일치하지 않습니다.") {
      return NextResponse.json({ code: "PASSWORD_MISMATCH", error: error.message }, { status: 403 });
    }
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, "Failed to update comment");
    return NextResponse.json(
      { error: "댓글 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE /api/comments/[id] - 댓글 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const commentId = parseInt(id, 10);

    if (isNaN(commentId)) {
      return NextResponse.json(
        { error: "유효하지 않은 댓글 ID입니다." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    const { comment } = getRepositories();
    const deleted = await comment.deleteComment(commentId, password);

    if (!deleted) {
      return NextResponse.json(
        { code: "NOT_FOUND", error: "댓글을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "비밀번호가 일치하지 않습니다.") {
      return NextResponse.json({ code: "PASSWORD_MISMATCH", error: error.message }, { status: 403 });
    }
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, "Failed to delete comment");
    return NextResponse.json(
      { error: "댓글 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
