import { and, asc, desc, eq, inArray, isNotNull, like, ne, or, sql } from "drizzle-orm";
import { NewPost, posts } from "../schema";
import { UpdatePost } from "../schema/posts";
import type { PostData, SeriesInfo } from "../types";
import { BaseRepository } from "./BaseRepository";
import { env } from "@/env";
import logger from "@/lib/logger";

const log = logger.child({ module: "infra/db/repositories/PostRepository" });

function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export function tagIntersectionSize(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(a.map((t) => t.toLowerCase()));
  let count = 0;
  for (const t of b) if (set.has(t.toLowerCase())) count++;
  return count;
}

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
        categories: posts.categories,
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

  async getRecentActive({ limit = 50 }: { limit?: number } = {}): Promise<
    Array<
      Pick<
        PostData,
        | "title"
        | "path"
        | "slug"
        | "category"
        | "subcategory"
        | "folders"
        | "description"
        | "content"
        | "createdAt"
      >
    >
  > {
    const result = await this.db
      .select({
        title: posts.title,
        path: posts.path,
        slug: posts.slug,
        category: posts.category,
        subcategory: posts.subcategory,
        folders: posts.folders,
        description: posts.description,
        content: posts.content,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(eq(posts.isActive, true))
      .orderBy(desc(posts.createdAt))
      .limit(limit);

    return result.map((p) => ({
      ...p,
      folders: p.folders || [],
    }));
  }

  async getRecentActiveLite({ limit = 50 }: { limit?: number } = {}): Promise<
    Array<
      Pick<
        PostData,
        | "title"
        | "path"
        | "slug"
        | "category"
        | "subcategory"
        | "folders"
        | "description"
        | "createdAt"
      >
    >
  > {
    const result = await this.db
      .select({
        title: posts.title,
        path: posts.path,
        slug: posts.slug,
        category: posts.category,
        subcategory: posts.subcategory,
        folders: posts.folders,
        description: posts.description,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(eq(posts.isActive, true))
      .orderBy(desc(posts.createdAt))
      .limit(limit);

    return result.map((p) => ({
      ...p,
      folders: p.folders || [],
    }));
  }

  async getRecentPostsCursor(params: {
    limit: number;
    cursor?: { updatedAt: Date; id: number };
  }): Promise<Array<PostData & { updatedAt: Date; id: number }>> {
    const { limit, cursor } = params;
    const whereExpr = cursor
      ? and(
          eq(posts.isActive, true),
          sql`(${posts.updatedAt}, ${posts.id}) < (${cursor.updatedAt}, ${cursor.id})`
        )
      : eq(posts.isActive, true);

    const result = await this.db
      .select({
        title: posts.title,
        path: posts.path,
        slug: posts.slug,
        category: posts.category,
        subcategory: posts.subcategory,
        folders: posts.folders,
        description: posts.description,
        updatedAt: posts.updatedAt,
        id: posts.id,
      })
      .from(posts)
      .where(whereExpr)
      .orderBy(desc(posts.updatedAt), desc(posts.id))
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
        categories: post.categories,
        subcategory: post.subcategory,
        folders: post.folders || [],
        description: post.description,
        series: post.series,
        seriesOrder: post.seriesOrder,
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
    const useFulltextSearch = (env.USE_FULLTEXT_SEARCH ?? "true") !== "false";

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
            categories: posts.categories,
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
          categories: p.categories,
          subcategory: p.subcategory,
          folders: p.folders || [],
          description: p.description,
        }));
      } catch (error) {
        log.warn({ err: error instanceof Error ? error : new Error(String(error)) }, "FULLTEXT search failed, falling back to LIKE search");
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
        categories: posts.categories,
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

  async deactivateByIds(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.db
      .update(posts)
      .set({ isActive: false })
      .where(inArray(posts.id, ids));
    return result[0].affectedRows;
  }

  async getPostsByTag(
    tag: string,
    { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<PostData[]> {
    const normalized = tag.trim().toLowerCase();
    const result = await this.db
      .select({
        title: posts.title,
        path: posts.path,
        slug: posts.slug,
        category: posts.category,
        subcategory: posts.subcategory,
        folders: posts.folders,
        description: posts.description,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
      })
      .from(posts)
      .where(
        and(
          eq(posts.isActive, true),
          sql`JSON_CONTAINS(${posts.tags}, JSON_QUOTE(${normalized}))`,
        ),
      )
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);
    return result.map((p) => ({ ...p, folders: p.folders || [] }));
  }

  async getCrossCategoryPosts(folderPath: string): Promise<PostData[]> {
    const escapedFolderPrefix = `${escapeLikePattern(folderPath)}/%`;

    const result = await this.db
      .select({
        title: posts.title,
        path: posts.path,
        slug: posts.slug,
        category: posts.category,
        subcategory: posts.subcategory,
        folders: posts.folders,
        description: posts.description,
        categories: posts.categories,
      })
      .from(posts)
      .where(
        and(
          eq(posts.isActive, true),
          sql`JSON_CONTAINS(${posts.categories}, JSON_QUOTE(${folderPath}))`,
          sql`${posts.path} NOT LIKE ${escapedFolderPrefix} ESCAPE '\\'`,
        ),
      )
      .orderBy(asc(posts.title));
    return result.map((p) => ({ ...p, folders: p.folders || [] }));
  }

  async countPostsByTag(tag: string): Promise<number> {
    const normalized = tag.trim().toLowerCase();
    const [{ count }] = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(posts)
      .where(
        and(
          eq(posts.isActive, true),
          sql`JSON_CONTAINS(${posts.tags}, JSON_QUOTE(${normalized}))`,
        ),
      );
    return Number(count);
  }

  async create(newPost: NewPost) {
    await this.db.insert(posts).values(newPost);
  }

  async update(postId: number, newPost: UpdatePost) {
    await this.db.update(posts).set(newPost).where(eq(posts.id, postId));
  }

  async getAllForSync(): Promise<
    Array<{ id: number; path: string; sha: string | null; isActive: boolean }>
  > {
    return this.db
      .select({
        id: posts.id,
        path: posts.path,
        sha: posts.sha,
        isActive: posts.isActive,
      })
      .from(posts);
  }

  async getDistinctActiveCategoryCount(): Promise<number> {
    const result = await this.db
      .select({ count: sql<string>`COUNT(DISTINCT ${posts.category})` })
      .from(posts)
      .where(eq(posts.isActive, true));
    return Number(result[0]?.count ?? 0);
  }

  async getLastActiveUpdatedAt(): Promise<Date | null> {
    const result = await this.db
      .select({ maxUpdatedAt: sql<Date | null>`MAX(${posts.updatedAt})` })
      .from(posts)
      .where(eq(posts.isActive, true));
    return result[0]?.maxUpdatedAt ?? null;
  }

  async getAllWithContent(): Promise<
    Array<{ id: number; path: string; title: string; content: string | null }>
  > {
    return this.db
      .select({
        id: posts.id,
        path: posts.path,
        title: posts.title,
        content: posts.content,
      })
      .from(posts);
  }

  async getCategoryStats(): Promise<
    Array<{ category: string; count: number }>
  > {
    const result = await this.db
      .select({
        category: posts.category,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(posts)
      .where(eq(posts.isActive, true))
      .groupBy(posts.category);

    return result.map((r) => ({
      category: r.category,
      count: Number(r.count),
    }));
  }

  async getActivePostCount(): Promise<number> {
    const result = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(posts)
      .where(eq(posts.isActive, true));
    return Number(result[0]?.count ?? 0);
  }

  async getPostsBySeries(series: string): Promise<PostData[]> {
    const result = await this.db
      .select({
        title: posts.title,
        path: posts.path,
        slug: posts.slug,
        category: posts.category,
        subcategory: posts.subcategory,
        folders: posts.folders,
        description: posts.description,
        series: posts.series,
        seriesOrder: posts.seriesOrder,
      })
      .from(posts)
      .where(and(eq(posts.isActive, true), eq(posts.series, series)))
      .orderBy(asc(posts.seriesOrder));

    return result.map((p) => ({
      ...p,
      folders: p.folders || [],
    }));
  }

  async getSeriesNeighbors(
    post: PostData,
  ): Promise<{ prev: PostData | null; next: PostData | null; total: number }> {
    if (!post.series || post.seriesOrder == null) {
      return { prev: null, next: null, total: 0 };
    }
    const all = await this.getPostsBySeries(post.series);
    const idx = all.findIndex((p) => p.path === post.path);
    if (idx === -1) return { prev: null, next: null, total: all.length };
    return {
      prev: idx > 0 ? all[idx - 1] : null,
      next: idx < all.length - 1 ? all[idx + 1] : null,
      total: all.length,
    };
  }

  async getRelatedPosts(slug: string, limit = 4): Promise<PostData[]> {
    try {
      const current = await this.db
        .select({ id: posts.id, category: posts.category, tags: posts.tags })
        .from(posts)
        .where(and(eq(posts.path, slug), eq(posts.isActive, true)))
        .limit(1);

      const cur = current[0];
      if (!cur) return [];

      const currentTags = cur.tags ?? [];

      // limit 의 4배까지 후보를 fetch 한 뒤 태그 교집합 점수로 재정렬.
      // 점수 동점은 createdAt desc (stable sort) 로 자연 정렬.
      const candidates = await this.db
        .select({
          title: posts.title,
          path: posts.path,
          slug: posts.slug,
          category: posts.category,
          subcategory: posts.subcategory,
          folders: posts.folders,
          description: posts.description,
          series: posts.series,
          seriesOrder: posts.seriesOrder,
          createdAt: posts.createdAt,
          updatedAt: posts.updatedAt,
          tags: posts.tags,
        })
        .from(posts)
        .where(
          and(
            eq(posts.isActive, true),
            eq(posts.category, cur.category),
            ne(posts.id, cur.id),
          ),
        )
        .orderBy(desc(posts.createdAt))
        .limit(limit * 4);

      const scored = candidates.map((p) => ({
        post: p,
        score: tagIntersectionSize(p.tags ?? [], currentTags),
      }));

      scored.sort((a, b) => b.score - a.score);

      return scored.slice(0, limit).map(({ post: p }) => ({
        title: p.title,
        path: p.path,
        slug: p.slug,
        category: p.category,
        subcategory: p.subcategory,
        folders: p.folders || [],
        description: p.description,
        series: p.series,
        seriesOrder: p.seriesOrder,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
    } catch (error) {
      log.error(
        { err: error instanceof Error ? error : new Error(String(error)) },
        "getRelatedPosts failed",
      );
      return [];
    }
  }

  async getAllSeries(limit?: number): Promise<SeriesInfo[]> {
    const baseQuery = this.db
      .select({
        series: posts.series,
        postCount: sql<string>`count(*)`,
        latestUpdatedAt: sql<Date | null>`max(${posts.updatedAt})`,
        minSeriesOrder: sql<number>`min(${posts.seriesOrder})`,
      })
      .from(posts)
      .where(and(eq(posts.isActive, true), isNotNull(posts.series)))
      .groupBy(posts.series)
      .orderBy(sql`max(${posts.updatedAt}) desc`);

    const aggregates =
      typeof limit === "number" ? await baseQuery.limit(limit) : await baseQuery;
    if (aggregates.length === 0) return [];

    const tuples = aggregates.map(
      (a) => sql`(${a.series}, ${a.minSeriesOrder})`,
    );

    const firstPosts = await this.db
      .select({
        title: posts.title,
        description: posts.description,
        category: posts.category,
        slug: posts.slug,
        path: posts.path,
        series: posts.series,
        seriesOrder: posts.seriesOrder,
      })
      .from(posts)
      .where(
        and(
          eq(posts.isActive, true),
          sql`(${posts.series}, ${posts.seriesOrder}) IN (${sql.join(tuples, sql`, `)})`,
        ),
      );

    const firstPostByName = new Map(
      firstPosts.flatMap((p) => (p.series === null ? [] : [[p.series, p] as const])),
    );

    return aggregates.flatMap((a) => {
      if (a.series === null) return [];
      const first = firstPostByName.get(a.series);
      if (!first) return [];
      return [
        {
          name: a.series,
          postCount: Number(a.postCount),
          latestUpdatedAt: a.latestUpdatedAt,
          firstPost: {
            title: first.title,
            description: first.description,
            category: first.category,
            slug: first.slug,
            path: first.path,
          },
        },
      ];
    });
  }

  async countSeries(): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<string>`count(distinct ${posts.series})` })
      .from(posts)
      .where(and(eq(posts.isActive, true), isNotNull(posts.series)));
    return Number(count);
  }
}
