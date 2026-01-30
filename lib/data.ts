// 데이터 소스 추상화 레이어
// 페이지 조회 시 DB만 사용 (sync 작업에서만 GitHub API 사용)

import * as dbQueries from "./db-queries";

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
  post?: PostData;
}

export interface CategoryData {
  name: string;
  slug: string;
  icon: string | null;
  count: number;
}

// 카테고리 목록 가져오기
export async function getCategories(): Promise<CategoryData[]> {
  return dbQueries.getCategories();
}

// 카테고리별 포스트 가져오기
export async function getPostsByCategory(
  category: string
): Promise<PostData[]> {
  return dbQueries.getPostsByCategory(category);
}

// 최근 포스트 가져오기
export async function getRecentPosts(limit: number = 10): Promise<PostData[]> {
  return dbQueries.getRecentPosts(limit);
}

// 단일 포스트 가져오기
export async function getPost(
  slug: string
): Promise<{ content: string; post: PostData } | null> {
  return dbQueries.getPost(slug);
}

// 모든 포스트 경로 가져오기 (정적 생성용)
export async function getAllPostPaths(): Promise<string[]> {
  return dbQueries.getAllPostPaths();
}

// 폴더 콘텐츠 가져오기 (n-depth 지원)
export async function getFolderContents(folderPath: string): Promise<{
  folders: FolderItemData[];
  posts: PostData[];
  readme: string | null;
}> {
  return dbQueries.getFolderContents(folderPath);
}

// 모든 폴더 경로 가져오기 (정적 생성용)
export async function getAllFolderPaths(): Promise<string[][]> {
  return dbQueries.getAllFolderPaths();
}

// 카테고리 아이콘 가져오기
export function getCategoryIcon(category: string): string {
  return dbQueries.getCategoryIcon(category);
}

// 포스트 검색
export async function searchPosts(
  query: string,
  limit: number = 20
): Promise<PostData[]> {
  return dbQueries.searchPosts(query, limit);
}

// 데이터 소스 정보 (항상 database)
export function getDataSource(): "database" {
  return "database";
}
