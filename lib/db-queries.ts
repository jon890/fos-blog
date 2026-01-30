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
  content?: string | null;
  description?: string | null;
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
      description: posts.description,
    })
    .from(posts)
    .where(and(eq(posts.category, category), eq(posts.isActive, true)))
    .orderBy(posts.title);

  return result;
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
      description: posts.description,
    })
    .from(posts)
    .where(eq(posts.isActive, true))
    .orderBy(desc(posts.updatedAt))
    .limit(limit);

  return result;
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

// 카테고리 아이콘 가져오기
export function getCategoryIcon(category: string): string {
  return categoryIcons[category] || "📁";
}
