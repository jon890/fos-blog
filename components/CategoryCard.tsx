import Link from "next/link";
import { CategoryData } from "@/lib/data";
import { Folder } from "lucide-react";

interface CategoryCardProps {
  category: CategoryData;
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      href={`/category/${encodeURIComponent(category.slug)}`}
      className="group block p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{category.icon}</span>
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {category.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {category.count}개의 글
            </p>
          </div>
        </div>
        <Folder className="w-5 h-5 text-gray-400 dark:text-gray-600 group-hover:text-blue-500 transition-colors" />
      </div>
    </Link>
  );
}
