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
}
