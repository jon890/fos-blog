import { db } from "@/db";
import { posts, categories, folders } from "@/db/schema";
import { eq, desc, and, or, like, sql } from "drizzle-orm";

// ===== 인터페이스 정의 =====

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

// DbQueries 인터페이스 (덕타이핑용)
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

// ===== 카테고리 아이콘 매핑 =====

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

// ===== RealDbQueries (실제 DB 사용) =====

function createRealDbQueries(): DbQueries {
  const getDb = () => {
    if (!db) {
      throw new Error("Database not configured");
    }
    return db;
  };

  return {
    async getCategories(): Promise<CategoryData[]> {
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
    },

    async getPostsByCategory(category: string): Promise<PostData[]> {
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
    },

    async getRecentPosts(limit: number = 10): Promise<PostData[]> {
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
    },

    async getPost(
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
    },

    async getAllPostPaths(): Promise<string[]> {
      const database = getDb();
      const result = await database
        .select({ path: posts.path })
        .from(posts)
        .where(eq(posts.isActive, true));

      return result.map((p) => p.path);
    },

    async getFolderContents(folderPath: string): Promise<FolderContentsResult> {
      const database = getDb();
      const pathParts = folderPath.split("/").filter(Boolean);
      const depth = pathParts.length;

      const allPosts = await database
        .select()
        .from(posts)
        .where(eq(posts.isActive, true));

      const matchingPosts = allPosts.filter((post) => {
        return post.path.startsWith(folderPath + "/");
      });

      const directPosts = matchingPosts.filter((post) => {
        const postPathParts = post.path.split("/");
        const postFolderDepth = postPathParts.length - 1;
        return postFolderDepth === depth;
      });

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

      const foldersData: FolderItemData[] = Array.from(subfolderMap.entries())
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

      const folderRecord = await database
        .select({ readme: folders.readme })
        .from(folders)
        .where(eq(folders.path, folderPath))
        .limit(1);

      const readme = folderRecord[0]?.readme || null;

      return { folders: foldersData, posts: postsData, readme };
    },

    async getAllFolderPaths(): Promise<string[][]> {
      const database = getDb();
      const allPosts = await database
        .select({ path: posts.path })
        .from(posts)
        .where(eq(posts.isActive, true));

      const folderPaths = new Set<string>();

      for (const post of allPosts) {
        const parts = post.path.split("/");
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
    },

    getCategoryIcon(category: string): string {
      return categoryIcons[category] || "📁";
    },
  };
}

// ===== 싱글톤 인스턴스 선택 =====

const dbQueries: DbQueries = db ? createRealDbQueries() : fakeDbQueries;

// ===== Export 함수들 (기존 API 유지) =====

export const getCategories = () => dbQueries.getCategories();
export const getPostsByCategory = (category: string) =>
  dbQueries.getPostsByCategory(category);
export const getRecentPosts = (limit?: number) =>
  dbQueries.getRecentPosts(limit);
export const getPost = (slug: string) => dbQueries.getPost(slug);
export const getAllPostPaths = () => dbQueries.getAllPostPaths();
export const getFolderContents = (folderPath: string) =>
  dbQueries.getFolderContents(folderPath);
export const getAllFolderPaths = () => dbQueries.getAllFolderPaths();
export const getCategoryIcon = (category: string) =>
  dbQueries.getCategoryIcon(category);

// ===== 검색 기능 =====

// FULLTEXT 검색 사용 여부 (환경변수로 제어 가능)
const useFulltextSearch = process.env.USE_FULLTEXT_SEARCH !== "false";

export async function searchPosts(
  query: string,
  limit: number = 20
): Promise<PostData[]> {
  if (!db || !query.trim()) {
    return [];
  }

  const searchQuery = query.trim();

  // FULLTEXT 검색 시도 (MySQL MATCH AGAINST)
  if (useFulltextSearch) {
    try {
      // FULLTEXT 검색: 자연어 모드로 검색
      // Boolean 모드로 부분 일치 지원 (+keyword*, *keyword* 등)
      const fulltextQuery = searchQuery
        .split(/\s+/)
        .map((word) => `+${word}*`)
        .join(" ");

      const result = await db
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
        .where(
          and(
            eq(posts.isActive, true),
            sql`MATCH(title, content, description) AGAINST(${fulltextQuery} IN BOOLEAN MODE)`
          )
        )
        // 관련도 점수로 정렬 (높은 점수가 먼저)
        .orderBy(sql`MATCH(title, content, description) AGAINST(${fulltextQuery} IN BOOLEAN MODE) DESC`)
        .limit(limit);

      return result.map((p) => ({
        title: p.title,
        path: p.path,
        slug: p.slug,
        category: p.category,
        subcategory: p.subcategory,
        folders: p.folders || [],
        description: p.description,
      }));
    } catch (error) {
      // FULLTEXT 인덱스가 없으면 LIKE 검색으로 fallback
      console.warn(
        "FULLTEXT search failed, falling back to LIKE search:",
        error
      );
    }
  }

  // Fallback: LIKE 검색
  const searchTerm = `%${searchQuery}%`;

  const result = await db
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
    .where(
      and(
        eq(posts.isActive, true),
        or(
          like(posts.title, searchTerm),
          like(posts.content, searchTerm),
          like(posts.description, searchTerm)
        )
      )
    )
    .orderBy(desc(posts.updatedAt))
    .limit(limit);

  return result.map((p) => ({
    ...p,
    folders: p.folders || [],
  }));
}
