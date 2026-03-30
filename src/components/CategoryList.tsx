import type { CategoryData } from "@/db/types";
import { CategoryCard } from "./CategoryCard";

interface CategoryListProps {
  categories: CategoryData[];
}

export function CategoryList({ categories }: CategoryListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {categories.map((category) => (
        <CategoryCard key={category.slug} category={category} />
      ))}
    </div>
  );
}
