// 데이터 소스 추상화 레이어
// DB가 설정되어 있으면 DB 사용, 아니면 GitHub API 사용

import * as dbQueries from "./db-queries";
import * as githubApi from "./github";

// DB 사용 여부 확인
const useDatabase = !!process.env.DATABASE_URL;

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
  if (useDatabase) {
    return dbQueries.getCategories();
  }

  const categories = await githubApi.getCategories();
  return categories.map((cat) => ({
    name: cat.name,
    slug: cat.slug,
    icon: cat.icon || null,
    count: cat.count,
  }));
}

// 카테고리별 포스트 가져오기
export async function getPostsByCategory(
  category: string
): Promise<PostData[]> {
  if (useDatabase) {
    return dbQueries.getPostsByCategory(category);
  }

  const posts = await githubApi.getPostsByCategory(category);
  return posts.map((post) => ({
    title: post.title,
    path: post.path,
    slug: post.slug,
    category: post.category,
    subcategory: post.subcategory,
  }));
}

// 최근 포스트 가져오기
export async function getRecentPosts(limit: number = 10): Promise<PostData[]> {
  if (useDatabase) {
    return dbQueries.getRecentPosts(limit);
  }

  const posts = await githubApi.getRecentPosts(limit);
  return posts.map((post) => ({
    title: post.title,
    path: post.path,
    slug: post.slug,
    category: post.category,
    subcategory: post.subcategory,
  }));
}

// 단일 포스트 가져오기
export async function getPost(
  slug: string
): Promise<{ content: string; post: PostData } | null> {
  if (useDatabase) {
    return dbQueries.getPost(slug);
  }

  const result = await githubApi.getPost(slug);
  if (!result) return null;

  return {
    content: result.content,
    post: {
      title: result.post.title,
      path: result.post.path,
      slug: result.post.slug,
      category: result.post.category,
      subcategory: result.post.subcategory,
    },
  };
}

// 모든 포스트 경로 가져오기 (정적 생성용)
export async function getAllPostPaths(): Promise<string[]> {
  if (useDatabase) {
    return dbQueries.getAllPostPaths();
  }

  const posts = await githubApi.getAllMarkdownFiles();
  return posts.map((post) => post.path);
}

// 폴더 콘텐츠 가져오기 (n-depth 지원)
export async function getFolderContents(folderPath: string): Promise<{
  folders: FolderItemData[];
  posts: PostData[];
  readme: string | null;
}> {
  if (useDatabase) {
    const dbResult = await dbQueries.getFolderContents(folderPath);
    // DB에서는 README를 가져올 수 없으므로 GitHub API로 폴백
    const readme = await githubApi.getFolderReadme(folderPath);
    return { ...dbResult, readme };
  }

  const result = await githubApi.getFolderContents(folderPath);

  return {
    folders: result.folders.map((f) => ({
      name: f.name,
      type: f.type,
      path: f.path,
      count: f.count,
    })),
    posts: result.posts.map((p) => ({
      title: p.title,
      path: p.path,
      slug: p.slug,
      category: p.category,
      subcategory: p.subcategory,
      folders: p.folders,
    })),
    readme: result.readme,
  };
}

// 모든 폴더 경로 가져오기 (정적 생성용)
export async function getAllFolderPaths(): Promise<string[][]> {
  if (useDatabase) {
    return dbQueries.getAllFolderPaths();
  }
  return githubApi.getAllFolderPaths();
}

// 카테고리 아이콘 가져오기
export function getCategoryIcon(category: string): string {
  return dbQueries.getCategoryIcon(category);
}

// 데이터 소스 정보
export function getDataSource(): "database" | "github" {
  return useDatabase ? "database" : "github";
}
