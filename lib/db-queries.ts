import { getDb } from "@/db";
import { DbQueries, categoryIcons, DEFAULT_CATEGORY_ICON } from "@/db/queries";

// 타입 re-export
export type {
  PostData,
  CategoryData,
  FolderItemData,
  FolderContentsResult,
} from "@/db/types";

// ===== 싱글톤 인스턴스 =====

let cachedDbQueries: DbQueries | null = null;

function getDbQueries(): DbQueries | null {
  const db = getDb();
  if (!db) {
    console.warn("Database not connected");
    return null;
  }

  if (!cachedDbQueries) {
    cachedDbQueries = new DbQueries(db);
  }
  return cachedDbQueries;
}

// ===== Fallback 함수들 (DB 없을 때) =====

const emptyCategories = async () => [];
const emptyPosts = async () => [];
const emptyPost = async () => null;
const emptyPaths = async () => [];
const emptyFolderContents = async () => ({
  folders: [],
  posts: [],
  readme: null,
});
const emptyFolderPaths = async () => [];

// ===== Export 함수들 =====

export const getCategories = () =>
  getDbQueries()?.getCategories() ?? emptyCategories();

export const getPostsByCategory = (category: string) =>
  getDbQueries()?.getPostsByCategory(category) ?? emptyPosts();

export const getRecentPosts = (limit?: number) =>
  getDbQueries()?.getRecentPosts(limit) ?? emptyPosts();

export const getPost = (slug: string) =>
  getDbQueries()?.getPost(slug) ?? emptyPost();

export const getAllPostPaths = () =>
  getDbQueries()?.getAllPostPaths() ?? emptyPaths();

export const getFolderContents = (folderPath: string) =>
  getDbQueries()?.getFolderContents(folderPath) ?? emptyFolderContents();

export const getAllFolderPaths = () =>
  getDbQueries()?.getAllFolderPaths() ?? emptyFolderPaths();

export const getCategoryIcon = (category: string) =>
  getDbQueries()?.getCategoryIcon(category) ??
  categoryIcons[category] ??
  DEFAULT_CATEGORY_ICON;

export const searchPosts = (query: string, limit?: number) =>
  getDbQueries()?.searchPosts(query, limit) ?? emptyPosts();
