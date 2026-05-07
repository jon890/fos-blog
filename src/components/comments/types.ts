// 클라이언트 컴포넌트에서 사용하는 댓글 타입 — Drizzle 스키마 직접 import 시 node:fs 번들 오염 방지
export interface CommentData {
  id: number;
  postSlug: string;
  nickname: string;
  content: string;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}
