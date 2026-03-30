import { MySql2Database } from "drizzle-orm/mysql2";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "./constants";
import { getDb } from "./index";
import {
  CategoryRepository,
  CommentRepository,
  FolderRepository,
  PostRepository,
  VisitRepository,
  type CommentData,
  type CreateCommentInput,
} from "./repositories";
import type * as schema from "./schema";
import type {
  CategoryData,
  FolderContentsResult,
  FolderItemData,
  PostData,
} from "./types";

// 타입 re-export
export { categoryIcons, DEFAULT_CATEGORY_ICON };
export type {
  CategoryData,
  CommentData,
  CreateCommentInput,
  FolderContentsResult,
  FolderItemData,
  PostData,
};

// ===== DbQueries 파사드 클래스 =====

export class DbQueries {
  private categoryRepo: CategoryRepository;
  private postRepo: PostRepository;
  private folderRepo: FolderRepository;
  private commentRepo: CommentRepository;
  private visitRepo: VisitRepository;

  constructor(db: MySql2Database<typeof schema>) {
    this.categoryRepo = new CategoryRepository(db);
    this.postRepo = new PostRepository(db);
    this.folderRepo = new FolderRepository(db);
    this.commentRepo = new CommentRepository(db);
    this.visitRepo = new VisitRepository(db);
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

  getAllPostsForSitemap(): Promise<{ path: string; updatedAt: Date | null }[]> {
    return this.postRepo.getAllPostsForSitemap();
  }

  getAllPostsForSidebar(): Promise<{ path: string; title: string }[]> {
    return this.postRepo.getAllPostsForSidebar();
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

  getPopularPosts(limit?: number): Promise<Array<PostData & { visitCount: number }>> {
    return this.visitRepo.getPopularPostPaths((limit ?? 6) * 3).then(async (popularPaths) => {
      if (popularPaths.length === 0) return [];
      const paths = popularPaths.map(p => p.path);
      const postDataList = await this.postRepo.getPostsByPaths(paths);
      const visitMap = new Map(popularPaths.map(p => [p.path, p.visitCount]));
      return postDataList
        .map(post => ({ ...post, visitCount: visitMap.get(post.path) ?? 0 }))
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, limit ?? 6);
    });
  }

  // ===== Visit =====
  recordVisit(pagePath: string, ipHash: string): Promise<boolean> {
    return this.visitRepo.recordVisit(pagePath, ipHash);
  }

  getVisitCount(pagePath: string): Promise<number> {
    return this.visitRepo.getVisitCount(pagePath);
  }

  getTotalVisitCount(): Promise<number> {
    return this.visitRepo.getTotalVisitCount();
  }

  getPostVisitCounts(pagePaths: string[]): Promise<Record<string, number>> {
    return this.visitRepo.getPostVisitCounts(pagePaths);
  }

  getTodayVisitorCount(): Promise<number> {
    return this.visitRepo.getTodayVisitorCount();
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
  cachedInstance = new DbQueries(db);
  return cachedInstance;
}
