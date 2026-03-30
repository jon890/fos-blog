import { cache } from "react";
import { getDb } from "@/infra/db";
import { CategoryRepository } from "./CategoryRepository";
import { CommentRepository } from "./CommentRepository";
import { FolderRepository } from "./FolderRepository";
import { PostRepository } from "./PostRepository";
import { SyncLogRepository } from "./SyncLogRepository";
import { VisitRepository } from "./VisitRepository";

export { BaseRepository, type DbInstance } from "./BaseRepository";
export { CategoryRepository } from "./CategoryRepository";
export { PostRepository } from "./PostRepository";
export { FolderRepository } from "./FolderRepository";
export {
  CommentRepository,
  type CommentData,
  type CreateCommentInput,
} from "./CommentRepository";
export { VisitRepository } from "./VisitRepository";
export { SyncLogRepository } from "./SyncLogRepository";

/**
 * 요청 범위 내에서 Repository 인스턴스를 재사용하는 팩토리
 * React.cache()로 동일 요청 내 중복 인스턴스화 방지
 */
export const getRepositories = cache(() => {
  const db = getDb();
  return {
    post: new PostRepository(db),
    category: new CategoryRepository(db),
    folder: new FolderRepository(db),
    comment: new CommentRepository(db),
    visit: new VisitRepository(db),
    syncLog: new SyncLogRepository(db),
  };
});
