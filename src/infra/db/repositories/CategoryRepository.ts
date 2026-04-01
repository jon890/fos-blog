import { desc } from "drizzle-orm";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "../constants";
import { categories } from "../schema";
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
