"use client";

import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/comments/Avatar";
import { formatRelativeTime } from "@/lib/format-time";
import type { CommentData } from "@/components/comments/types";

export interface CommentItemProps {
  comment: CommentData;
  onEdit: (comment: CommentData) => void;
  onDelete: (comment: CommentData) => void;
}

export function CommentItem({ comment, onEdit, onDelete }: CommentItemProps) {
  return (
    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[12px] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Avatar nickname={comment.nickname} size={36} />
          <span className="text-[var(--color-fg-primary)] font-medium">
            {comment.nickname}
          </span>
          <span className="text-[var(--color-fg-muted)] text-sm">
            {comment.createdAt ? formatRelativeTime(comment.createdAt) : ""}
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="댓글 수정"
            onClick={() => onEdit(comment)}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="댓글 삭제"
            onClick={() => onDelete(comment)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <p className="text-[var(--color-fg-secondary)] leading-relaxed whitespace-pre-wrap">
        {comment.content}
      </p>
    </div>
  );
}
