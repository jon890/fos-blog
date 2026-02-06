import { eq, desc, and, or, like, sql } from "drizzle-orm";
import { posts } from "../schema";
import type { PostData } from "../types";
import { BaseRepository } from "./BaseRepository";

export class PostRepository extends BaseRepository {
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
