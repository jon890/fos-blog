import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { NewPost, posts } from "../schema";
import { UpdatePost } from "../schema/posts";
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

  async getPostId(slug: string) {
    const exists = await this.db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.path, slug))
      .limit(1);

    if (exists.length === 0) {
      return null;
    }

    return exists[0].id;
  }

  async getPost(
    slug: string,
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
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
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

  async getAllPostsForSitemap(): Promise<
    { path: string; updatedAt: Date | null }[]
  > {
    return this.db
      .select({ path: posts.path, updatedAt: posts.updatedAt })
      .from(posts)
      .where(eq(posts.isActive, true));
  }

  async getPostsByPaths(paths: string[]): Promise<PostData[]> {
    if (paths.length === 0) return [];
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
      .where(and(inArray(posts.path, paths), eq(posts.isActive, true)));
    return result.map((p) => ({ ...p, folders: p.folders || [] }));
  }

  async getAllPostsForSidebar(): Promise<{ path: string; title: string }[]> {
    const result = await this.db
      .select({ path: posts.path, title: posts.title })
      .from(posts)
      .where(eq(posts.isActive, true))
      .orderBy(posts.path);
    return result;
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
              sql`MATCH(title, content, description) AGAINST(${fulltextQuery} IN BOOLEAN MODE)`,
            ),
          )
          .orderBy(
            sql`MATCH(title, content, description) AGAINST(${fulltextQuery} IN BOOLEAN MODE) DESC`,
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
          error,
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
            like(posts.description, searchTerm),
          ),
        ),
      )
      .orderBy(desc(posts.updatedAt))
      .limit(limit);

    return result.map((p) => ({
      ...p,
      folders: p.folders || [],
    }));
  }

  async deactive(filePath: string): Promise<boolean> {
    const result = await this.db
      .update(posts)
      .set({ isActive: false })
      .where(eq(posts.path, filePath));

    const success = Boolean(result[0].affectedRows === 1);
    return success;
  }

  async create(newPost: NewPost) {
    await this.db.insert(posts).values(newPost);
  }

  async update(postId: number, newPost: UpdatePost) {
    await this.db.update(posts).set(newPost).where(eq(posts.id, postId));
  }

  async getAllForSync(): Promise<
    Array<{ id: number; path: string; sha: string | null; isActive: boolean | null }>
  > {
    return this.db
      .select({ id: posts.id, path: posts.path, sha: posts.sha, isActive: posts.isActive })
      .from(posts);
  }

  async deactivateMissing(processedPaths: Set<string>): Promise<number> {
    const allPosts = await this.db
      .select({ id: posts.id, path: posts.path, isActive: posts.isActive })
      .from(posts);
    let count = 0;
    for (const post of allPosts) {
      if (!processedPaths.has(post.path) && post.isActive) {
        await this.db.update(posts).set({ isActive: false }).where(eq(posts.id, post.id));
        count++;
        console.log(`비활성화: ${post.path}`);
      }
    }
    return count;
  }

  async retitleAll(): Promise<{ total: number; updated: number; skipped: number }> {
    const { extractTitle } = await import("@/lib/markdown");
    const allPosts = await this.db
      .select({ path: posts.path, title: posts.title, content: posts.content })
      .from(posts);

    let updated = 0;
    let skipped = 0;

    for (const post of allPosts) {
      if (!post.content) {
        skipped++;
        continue;
      }
      const extractedTitle = extractTitle(post.content);
      if (!extractedTitle || extractedTitle === post.title) {
        skipped++;
        continue;
      }
      await this.db.update(posts).set({ title: extractedTitle }).where(eq(posts.path, post.path));
      updated++;
      console.log(`제목 업데이트: ${post.path} → ${extractedTitle}`);
    }
    return { total: allPosts.length, updated, skipped };
  }
}
