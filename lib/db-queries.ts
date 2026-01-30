import { db } from "@/db";
import {
  createRealDbQueries,
  categoryIcons,
  searchPosts as dbSearchPosts,
} from "@/db/queries";

// ===== 타입 정의 =====

export interface PostData {
  title: string;
  path: string;
  slug: string;
  category: string;
  subcategory?: string | null;
  folders?: string[];
  content?: string | null;
  description?: string | null;
}

export interface FolderItemData {
  name: string;
  type: "folder" | "file";
  path: string;
  count?: number;
}

export interface CategoryData {
  name: string;
  slug: string;
  icon: string | null;
  count: number;
}

export interface FolderContentsResult {
  folders: FolderItemData[];
  posts: PostData[];
  readme: string | null;
}

export interface DbQueries {
  getCategories(): Promise<CategoryData[]>;
  getPostsByCategory(category: string): Promise<PostData[]>;
  getRecentPosts(limit?: number): Promise<PostData[]>;
  getPost(slug: string): Promise<{ content: string; post: PostData } | null>;
  getAllPostPaths(): Promise<string[]>;
  getFolderContents(folderPath: string): Promise<FolderContentsResult>;
  getAllFolderPaths(): Promise<string[][]>;
  getCategoryIcon(category: string): string;
}

// ===== FakeDbQueries (DB 없을 때 사용) =====

const fakeDbQueries: DbQueries = {
  async getCategories() {
    return [];
  },
  async getPostsByCategory() {
    return [];
  },
  async getRecentPosts() {
    return [];
  },
  async getPost() {
    return null;
  },
  async getAllPostPaths() {
    return [];
  },
  async getFolderContents() {
    return { folders: [], posts: [], readme: null };
  },
  async getAllFolderPaths() {
    return [];
  },
  getCategoryIcon(category: string) {
    return categoryIcons[category] || "📁";
  },
};

// ===== 런타임 DB 선택 =====

let cachedRealDbQueries: DbQueries | null = null;

function getDbQueries(): DbQueries {
  if (db) {
    if (!cachedRealDbQueries) {
      cachedRealDbQueries = createRealDbQueries();
    }
    return cachedRealDbQueries;
  }
  console.warn("Database not connected, using fake queries");
  return fakeDbQueries;
}

// ===== Export 함수들 =====

export const getCategories = () => getDbQueries().getCategories();
export const getPostsByCategory = (category: string) =>
  getDbQueries().getPostsByCategory(category);
export const getRecentPosts = (limit?: number) =>
  getDbQueries().getRecentPosts(limit);
export const getPost = (slug: string) => getDbQueries().getPost(slug);
export const getAllPostPaths = () => getDbQueries().getAllPostPaths();
export const getFolderContents = (folderPath: string) =>
  getDbQueries().getFolderContents(folderPath);
export const getAllFolderPaths = () => getDbQueries().getAllFolderPaths();
export const getCategoryIcon = (category: string) =>
  getDbQueries().getCategoryIcon(category);
export const searchPosts = dbSearchPosts;
