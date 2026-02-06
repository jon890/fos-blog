import { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "./schema";
import { getDb } from "./index";
import type {
  PostData,
  CategoryData,
  FolderItemData,
  FolderContentsResult,
} from "./types";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "./constants";
import {
  CategoryRepository,
  PostRepository,
  FolderRepository,
  CommentRepository,
  type CommentData,
  type CreateCommentInput,
} from "./repositories";

// 타입 re-export
export type { PostData, CategoryData, FolderItemData, FolderContentsResult };
export type { CommentData, CreateCommentInput };
export { categoryIcons, DEFAULT_CATEGORY_ICON };

// ===== DbQueries 파사드 클래스 =====

export class DbQueries {
  private categoryRepo: CategoryRepository;
  private postRepo: PostRepository;
  private folderRepo: FolderRepository;
  private commentRepo: CommentRepository;

  constructor(db: MySql2Database<typeof schema>) {
    this.categoryRepo = new CategoryRepository(db);
    this.postRepo = new PostRepository(db);
    this.folderRepo = new FolderRepository(db);
    this.commentRepo = new CommentRepository(db);
  }

  // ===== Category =====
  getCategories(): Promise<CategoryData[]> {
    return this.categoryRepo.getCategories();
  }

  getCategoryIcon(category: string): string {
    return this.categoryRepo.getCategoryIcon(category);
  }

  // ===== Post =====
  getPostsByCategory(category: string): Promise<PostData[]> {
    return this.postRepo.getPostsByCategory(category);
  }

  getRecentPosts(limit?: number): Promise<PostData[]> {
    return this.postRepo.getRecentPosts(limit);
  }

  getPost(slug: string): Promise<{ content: string; post: PostData } | null> {
    return this.postRepo.getPost(slug);
  }

  getAllPostPaths(): Promise<string[]> {
    return this.postRepo.getAllPostPaths();
  }

  searchPosts(query: string, limit?: number): Promise<PostData[]> {
    return this.postRepo.searchPosts(query, limit);
  }

  // ===== Folder =====
  getFolderContents(folderPath: string): Promise<FolderContentsResult> {
    return this.folderRepo.getFolderContents(folderPath);
  }

  getAllFolderPaths(): Promise<string[][]> {
    return this.folderRepo.getAllFolderPaths();
  }

  // ===== Comment =====
  getCommentsByPostSlug(postSlug: string): Promise<CommentData[]> {
    return this.commentRepo.getCommentsByPostSlug(postSlug);
  }

  createComment(input: CreateCommentInput): Promise<CommentData> {
    return this.commentRepo.createComment(input);
  }

  updateComment(
    id: number,
    password: string,
    content: string
  ): Promise<CommentData | null> {
    return this.commentRepo.updateComment(id, password, content);
  }

  deleteComment(id: number, password: string): Promise<boolean> {
    return this.commentRepo.deleteComment(id, password);
  }

  getCommentCount(postSlug: string): Promise<number> {
    return this.commentRepo.getCommentCount(postSlug);
  }
}

// ===== 싱글톤 인스턴스 =====

let cachedInstance: DbQueries | null = null;

/**
 * DbQueries 싱글톤 인스턴스를 반환
 * DB 연결이 없으면 null 반환
 */
export function getDbQueries(): DbQueries | null {
  if (cachedInstance) {
    return cachedInstance;
  }

  const db = getDb();
  if (!db) {
    return null;
  }

  cachedInstance = new DbQueries(db);
  return cachedInstance;
}
