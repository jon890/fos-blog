"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Send, Trash2, Edit2, X, Check } from "lucide-react";

interface Comment {
  id: number;
  postSlug: string;
  nickname: string;
  content: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface CommentsProps {
  postSlug: string;
}

export function Comments({ postSlug }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 새 댓글 작성 폼
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 수정/삭제 상태
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [actionPassword, setActionPassword] = useState("");

  // 댓글 목록 조회
  useEffect(() => {
    let isMounted = true;
    const fetchComments = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/comments?slug=${encodeURIComponent(postSlug)}`
        );
        const data = await res.json();
        if (isMounted) {
          if (res.ok) {
            setComments(data.comments);
          } else {
            setError(data.error);
          }
        }
      } catch {
        if (isMounted) setError("댓글을 불러오는데 실패했습니다.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchComments();

    return () => {
      isMounted = false;
    };
  }, [postSlug]);

  // 댓글 작성
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postSlug, nickname, password, content }),
      });
      const data = await res.json();

      if (res.ok) {
        setComments([data.comment, ...comments]);
        setContent("");
        // 닉네임과 비밀번호는 유지
      } else {
        setError(data.error);
      }
    } catch {
      setError("댓글 작성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // 댓글 수정
  const handleEdit = async (id: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: actionPassword,
          content: editContent,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setComments(comments.map((c) => (c.id === id ? data.comment : c)));
        setEditingId(null);
        setEditContent("");
        setActionPassword("");
      } else {
        setError(data.error);
      }
    } catch {
      setError("댓글 수정에 실패했습니다.");
    }
  };

  // 댓글 삭제
  const handleDelete = async (id: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: actionPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setComments(comments.filter((c) => c.id !== id));
        setDeleteId(null);
        setActionPassword("");
      } else {
        setError(data.error);
      }
    } catch {
      setError("댓글 삭제에 실패했습니다.");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <section className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white mb-6">
        <MessageCircle className="w-5 h-5" />
        댓글 {comments.length > 0 && `(${comments.length})`}
      </h2>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* 댓글 작성 폼 */}
      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="닉네임"
            aria-label="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={100}
            required
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <input
            type="password"
            placeholder="비밀번호 (4자 이상)"
            aria-label="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={4}
            required
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <textarea
          placeholder="댓글을 작성해주세요..."
          aria-label="댓글 내용"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={5000}
          required
          rows={4}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            {submitting ? "작성 중..." : "댓글 작성"}
          </button>
        </div>
      </form>

      {/* 댓글 목록 */}
      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          댓글을 불러오는 중...
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          아직 댓글이 없습니다. 첫 댓글을 작성해보세요!
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
            >
              {/* 수정 모드 */}
              {editingId === comment.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none resize-none"
                  />
                  <input
                    type="password"
                    placeholder="비밀번호 확인"
                    value={actionPassword}
                    onChange={(e) => setActionPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(comment.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
                    >
                      <Check className="w-4 h-4" />
                      수정
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditContent("");
                        setActionPassword("");
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm"
                    >
                      <X className="w-4 h-4" />
                      취소
                    </button>
                  </div>
                </div>
              ) : deleteId === comment.id ? (
                /* 삭제 확인 모드 */
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    댓글을 삭제하려면 비밀번호를 입력해주세요.
                  </p>
                  <input
                    type="password"
                    placeholder="비밀번호 확인"
                    value={actionPassword}
                    onChange={(e) => setActionPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      삭제
                    </button>
                    <button
                      onClick={() => {
                        setDeleteId(null);
                        setActionPassword("");
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm"
                    >
                      <X className="w-4 h-4" />
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                /* 일반 모드 */
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {comment.nickname}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingId(comment.id);
                          setEditContent(comment.content);
                          setDeleteId(null);
                          setActionPassword("");
                        }}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                        title="수정"
                        aria-label="댓글 수정"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteId(comment.id);
                          setEditingId(null);
                          setActionPassword("");
                        }}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                        title="삭제"
                        aria-label="댓글 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
