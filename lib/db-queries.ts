import { db } from "@/db";
import { posts, categories } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm"; // DB가 설정되지 않으면 에러

function getDb() {
  if (!db) {
    throw new Error(
      "Database not configured. Set DATABASE_URL environment variable."
    );
  }
  return db;
}

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

// 카테고리 아이콘 매핑 (DB에 없을 경우 폴백)
const categoryIcons: Record<string, string> = {
  AI: "🤖",
  algorithm: "🧮",
  architecture: "🏗️",
  database: "🗄️",
  devops: "🚀",
  finance: "💰",
  git: "📝",
  go: "🐹",
  html: "🌐",
  http: "📡",
  internet: "🌍",
  interview: "💼",
  java: "☕",
  javascript: "⚡",
  kafka: "📨",
  network: "🔌",
  react: "⚛️",
  redis: "🔴",
  resume: "📄",
  css: "🎨",
  기술공유: "📢",
};

// 모든 카테고리 가져오기
export async function getCategories(): Promise<CategoryData[]> {
  const database = getDb();
  const result = await database
    .select()
    .from(categories)
    .orderBy(desc(categories.postCount));

  return result.map((cat) => ({
    name: cat.name,
    slug: cat.slug,
    icon: cat.icon || categoryIcons[cat.name] || "📁",
    count: cat.postCount,
  }));
}

// 카테고리별 포스트 가져오기
export async function getPostsByCategory(
  category: string
): Promise<PostData[]> {
  const database = getDb();
  const result = await database
    .select({
      title: posts.title,
      path: posts.path,
      slug: posts.slug,
      category: posts.category,
      subcategory: posts.subcategory,
      folders: posts.folders,
      description: posts.description,
    })
    .from(posts)
    .where(and(eq(posts.category, category), eq(posts.isActive, true)))
    .orderBy(posts.title);

  return result.map((p) => ({
    ...p,
    folders: p.folders || [],
  }));
}

// 최근 포스트 가져오기
export async function getRecentPosts(limit: number = 10): Promise<PostData[]> {
  const database = getDb();
  const result = await database
    .select({
      title: posts.title,
      path: posts.path,
      slug: posts.slug,
      category: posts.category,
      subcategory: posts.subcategory,
      folders: posts.folders,
      description: posts.description,
    })
    .from(posts)
    .where(eq(posts.isActive, true))
    .orderBy(desc(posts.updatedAt))
    .limit(limit);

  return result.map((p) => ({
    ...p,
    folders: p.folders || [],
  }));
}

// 단일 포스트 가져오기
export async function getPost(
  slug: string
): Promise<{ content: string; post: PostData } | null> {
  const database = getDb();
  const result = await database
    .select()
    .from(posts)
    .where(and(eq(posts.path, slug), eq(posts.isActive, true)))
    .limit(1);

  const post = result[0];
  if (!post || !post.content) {
    return null;
  }

  return {
    content: post.content,
    post: {
      title: post.title,
      path: post.path,
      slug: post.slug,
      category: post.category,
      subcategory: post.subcategory,
      folders: post.folders || [],
      description: post.description,
    },
  };
}

// 모든 포스트 경로 가져오기 (정적 생성용)
export async function getAllPostPaths(): Promise<string[]> {
  const database = getDb();
  const result = await database
    .select({ path: posts.path })
    .from(posts)
    .where(eq(posts.isActive, true));

  return result.map((p) => p.path);
}

// 폴더 콘텐츠 가져오기 (n-depth 지원)
export async function getFolderContents(
  folderPath: string
): Promise<{
  folders: FolderItemData[];
  posts: PostData[];
  readme: string | null;
}> {
  const database = getDb();
  const pathParts = folderPath.split("/").filter(Boolean);
  const depth = pathParts.length; // 현재 폴더 깊이

  // 해당 경로로 시작하는 모든 활성 포스트 가져오기
  const allPosts = await database
    .select()
    .from(posts)
    .where(eq(posts.isActive, true));

  // 해당 폴더 경로와 일치하는 포스트 필터링
  const matchingPosts = allPosts.filter((post) => {
    return post.path.startsWith(folderPath + "/");
  });

  // 현재 폴더에 직접 있는 포스트 (폴더 깊이가 현재 깊이와 같은 경우)
  const directPosts = matchingPosts.filter((post) => {
    const postPathParts = post.path.split("/");
    // 파일은 경로의 마지막이므로 폴더 수 = postPathParts.length - 1
    const postFolderDepth = postPathParts.length - 1;
    return postFolderDepth === depth;
  });

  // 하위 폴더 추출 (현재 깊이 + 1에 있는 고유 폴더들)
  const subfolderMap = new Map<string, number>();
  for (const post of matchingPosts) {
    const postPathParts = post.path.split("/");
    if (postPathParts.length > depth + 1) {
      const subfolder = postPathParts[depth];
      const subfolderPath = [...pathParts, subfolder].join("/");
      subfolderMap.set(
        subfolderPath,
        (subfolderMap.get(subfolderPath) || 0) + 1
      );
    }
  }

  const folders: FolderItemData[] = Array.from(subfolderMap.entries())
    .map(([path, count]) => ({
      name: path.split("/").pop() || "",
      type: "folder" as const,
      path,
      count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const postsData: PostData[] = directPosts
    .map((p) => ({
      title: p.title,
      path: p.path,
      slug: p.slug,
      category: p.category,
      subcategory: p.subcategory,
      folders: p.folders || [],
      description: p.description,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  // README는 DB에서 가져올 수 없으므로 null 반환 (GitHub API로 폴백)
  return { folders, posts: postsData, readme: null };
}

// 모든 폴더 경로 가져오기 (정적 생성용)
export async function getAllFolderPaths(): Promise<string[][]> {
  const database = getDb();
  const allPosts = await database
    .select({ path: posts.path })
    .from(posts)
    .where(eq(posts.isActive, true));

  // 모든 포스트 경로에서 고유 폴더 경로 추출
  const folderPaths = new Set<string>();

  for (const post of allPosts) {
    const parts = post.path.split("/");
    // 파일명 제외한 모든 폴더 경로 추가
    for (let i = 1; i <= parts.length - 1; i++) {
      const folderPath = parts.slice(0, i).join("/");
      if (folderPath) {
        folderPaths.add(folderPath);
      }
    }
  }

  return Array.from(folderPaths)
    .sort()
    .map((path) => path.split("/"));
}

// 카테고리 아이콘 가져오기
export function getCategoryIcon(category: string): string {
  return categoryIcons[category] || "📁";
}
