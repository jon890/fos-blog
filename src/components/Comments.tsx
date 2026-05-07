"use client";

import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { CommentData } from "@/components/comments/types";
import { CommentForm, type CommentFormValues } from "@/components/comments/CommentForm";
import { CommentItem } from "@/components/comments/CommentItem";
import { DeleteConfirmDialog } from "@/components/comments/DeleteConfirmDialog";

const USER_FRIENDLY_ERRORS: Record<string, string> = {
  PASSWORD_MISMATCH: "비밀번호가 일치하지 않습니다",
  NOT_FOUND: "댓글을 찾을 수 없습니다",
};

function friendlyError(code: string | undefined): string {
  return USER_FRIENDLY_ERRORS[code ?? ""] ?? "요청을 처리할 수 없습니다";
}

interface CommentsProps {
  postSlug: string;
}

export function Comments({ postSlug }: CommentsProps) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingComment, setEditingComment] = useState<CommentData | null>(null);
  const [deletingComment, setDeletingComment] = useState<CommentData | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchComments = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/comments?slug=${encodeURIComponent(postSlug)}`);
        const data = await res.json();
        if (isMounted) {
          if (res.ok) {
            setComments(data.comments);
          } else {
            toast.error("댓글을 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.");
          }
        }
      } catch (error) {
        console.error("[comments] fetch failed", error);
        if (isMounted) toast.error("댓글을 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchComments();
    return () => { isMounted = false; };
  }, [postSlug]);

  const handleCreate = async (values: CommentFormValues) => {
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postSlug, ...values }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [data.comment, ...prev]);
        toast.success("댓글이 등록되었습니다");
      } else {
        toast.error(friendlyError(data.code));
      }
    } catch (error) {
      console.error("[comments] create failed", error);
      toast.error("댓글 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const handleEdit = async (values: CommentFormValues) => {
    if (!editingComment) return;
    try {
      const res = await fetch(`/api/comments/${editingComment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c.id === editingComment.id ? data.comment : c))
        );
        setEditingComment(null);
        toast.success("댓글이 수정되었습니다");
      } else {
        toast.error(friendlyError(data.code));
      }
    } catch (error) {
      console.error("[comments] edit failed", error);
      toast.error("댓글 수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const handleDelete = async (password: string) => {
    if (!deletingComment) return;
    try {
      const res = await fetch(`/api/comments/${deletingComment.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== deletingComment.id));
        setDeletingComment(null);
        toast.success("댓글이 삭제되었습니다");
      } else {
        toast.error(friendlyError(data.code));
      }
    } catch (error) {
      console.error("[comments] delete failed", error);
      toast.error("댓글 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  return (
    <section className="mt-12 pt-8 border-t border-[var(--color-border-subtle)]">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-[var(--color-fg-primary)] mb-6">
        <MessageCircle className="w-5 h-5 text-[var(--color-brand-400)]" />
        댓글 ({comments.length})
      </h2>

      {editingComment ? (
        <div className="mb-8">
          <CommentForm
            mode="edit"
            initialContent={editingComment.content}
            initialNickname={editingComment.nickname}
            onSubmit={handleEdit}
            onCancel={() => setEditingComment(null)}
          />
        </div>
      ) : (
        <div className="mb-8">
          <CommentForm mode="create" onSubmit={handleCreate} />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-[var(--color-bg-subtle)] animate-pulse h-24 rounded-[12px]"
            />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-[var(--color-fg-muted)] text-center py-12">
          첫 댓글을 남겨주세요
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onEdit={setEditingComment}
              onDelete={setDeletingComment}
            />
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={deletingComment !== null}
        onOpenChange={(open) => { if (!open) setDeletingComment(null); }}
        onConfirm={handleDelete}
      />
    </section>
  );
}
