import { desc, eq, sql } from "drizzle-orm";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "../constants";
import { categories, posts } from "../schema";
import type { CategoryData } from "../types";
import { BaseRepository } from "./BaseRepository";

export class CategoryRepository extends BaseRepository {
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

  async rebuild(): Promise<void> {
    const categoryStats = await this.db
      .select({
        category: posts.category,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(posts)
      .where(eq(posts.isActive, true))
      .groupBy(posts.category);

    await this.db.transaction(async (tx) => {
      await tx.delete(categories);
      for (const stat of categoryStats) {
        await tx.insert(categories).values({
          name: stat.category,
          slug: stat.category,
          icon: categoryIcons[stat.category] || "📁",
          postCount: Number(stat.count),
        });
      }
    });
  }
}
