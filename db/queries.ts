import { MySql2Database } from "drizzle-orm/mysql2";
import { posts, categories, folders } from "./schema";
import { eq, desc, and, or, like, sql } from "drizzle-orm";
import type * as schema from "./schema";

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

// ===== 카테고리 아이콘 매핑 =====

export const categoryIcons: Record<string, string> = {
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

// ===== DbQueries 클래스 =====

export class DbQueries {
  constructor(private db: MySql2Database<typeof schema>) {}

  async getCategories(): Promise<CategoryData[]> {
    const result = await this.db
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

  async getPostsByCategory(category: string): Promise<PostData[]> {
    const result = await this.db
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

  async getRecentPosts(limit: number = 10): Promise<PostData[]> {
    const result = await this.db
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

  async getPost(
    slug: string
  ): Promise<{ content: string; post: PostData } | null> {
    const result = await this.db
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

  async getAllPostPaths(): Promise<string[]> {
    const result = await this.db
      .select({ path: posts.path })
      .from(posts)
      .where(eq(posts.isActive, true));

    return result.map((p) => p.path);
  }

  async getFolderContents(folderPath: string): Promise<FolderContentsResult> {
    const pathParts = folderPath.split("/").filter(Boolean);
    const depth = pathParts.length;

    const allPosts = await this.db
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

    const folderRecord = await this.db
      .select({ readme: folders.readme })
      .from(folders)
      .where(eq(folders.path, folderPath))
      .limit(1);

    const readme = folderRecord[0]?.readme || null;

    return { folders: foldersData, posts: postsData, readme };
  }

  async getAllFolderPaths(): Promise<string[][]> {
    const allPosts = await this.db
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
  }

  getCategoryIcon(category: string): string {
    return categoryIcons[category] || "📁";
  }

  // ===== 검색 기능 =====

  async searchPosts(query: string, limit: number = 20): Promise<PostData[]> {
    if (!query.trim()) {
      return [];
    }

    const searchQuery = query.trim();
    const useFulltextSearch = process.env.USE_FULLTEXT_SEARCH !== "false";

    // FULLTEXT 검색 시도 (MySQL MATCH AGAINST)
    if (useFulltextSearch) {
      try {
        const fulltextQuery = searchQuery
          .split(/\s+/)
          .map((word) => `+${word}*`)
          .join(" ");

        const result = await this.db
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
          .orderBy(
            sql`MATCH(title, content, description) AGAINST(${fulltextQuery} IN BOOLEAN MODE) DESC`
          )
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
        console.warn(
          "FULLTEXT search failed, falling back to LIKE search:",
          error
        );
      }
    }

    // Fallback: LIKE 검색
    const searchTerm = `%${searchQuery}%`;

    const result = await this.db
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
}
