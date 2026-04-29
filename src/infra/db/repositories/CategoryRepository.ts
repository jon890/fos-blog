import { and, desc, eq, sql } from "drizzle-orm";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "../constants";
import { categories, posts } from "../schema";
import type { CategoryData } from "../types";
import { BaseRepository } from "./BaseRepository";

export class CategoryRepository extends BaseRepository {
  async getCategoriesWithLatest(): Promise<Array<CategoryData & { latestUpdatedAt: Date | null }>> {
    const result = await this.db
      .select({
        name: categories.name,
        slug: categories.slug,
        icon: categories.icon,
        postCount: categories.postCount,
        latestUpdatedAt: sql<Date | null>`MAX(${posts.updatedAt})`,
      })
      .from(categories)
      .leftJoin(posts, and(eq(posts.category, categories.slug), eq(posts.isActive, true)))
      .groupBy(categories.id)
      .orderBy(desc(categories.postCount));

    return result.map((cat) => ({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon || categoryIcons[cat.name] || DEFAULT_CATEGORY_ICON,
      count: cat.postCount,
      latestUpdatedAt: cat.latestUpdatedAt,
    }));
  }

  async getCategories(): Promise<CategoryData[]> {
    const result = await this.db
      .select()
      .from(categories)
      .orderBy(desc(categories.postCount));

    return result.map((cat) => ({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon || categoryIcons[cat.name] || DEFAULT_CATEGORY_ICON,
      count: cat.postCount,
    }));
  }

  getCategoryIcon(category: string): string {
    return categoryIcons[category] || DEFAULT_CATEGORY_ICON;
  }

  async replaceAll(
    stats: Array<{ name: string; slug: string; icon: string; postCount: number }>,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(categories);
      for (const stat of stats) {
        await tx.insert(categories).values(stat);
      }
    });
  }
}
