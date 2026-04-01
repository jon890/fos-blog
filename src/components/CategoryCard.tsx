import Link from "next/link";
import type { CategoryData } from "@/infra/db/types";
import { Folder } from "lucide-react";

interface CategoryCardProps {
  category: CategoryData;
}

const CATEGORY_ACCENT: Record<string, string> = {
  java:         "border-l-amber-400 dark:border-l-amber-500",
  AI:           "border-l-purple-400 dark:border-l-purple-500",
  database:     "border-l-orange-400 dark:border-l-orange-500",
  devops:       "border-l-red-400 dark:border-l-red-500",
  javascript:   "border-l-yellow-400 dark:border-l-yellow-500",
  react:        "border-l-cyan-400 dark:border-l-cyan-500",
  algorithm:    "border-l-green-400 dark:border-l-green-500",
  architecture: "border-l-blue-400 dark:border-l-blue-500",
  interview:    "border-l-pink-400 dark:border-l-pink-500",
  network:      "border-l-indigo-400 dark:border-l-indigo-500",
  kafka:        "border-l-rose-400 dark:border-l-rose-500",
  internet:     "border-l-teal-400 dark:border-l-teal-500",
};

export function CategoryCard({ category }: CategoryCardProps) {
  const accent = CATEGORY_ACCENT[category.slug] ?? "border-l-gray-400 dark:border-l-gray-600";

  return (
    <Link
      href={`/category/${encodeURIComponent(category.slug)}`}
      className={`group block p-3 md:p-5 rounded-xl border border-l-4 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300 ${accent}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl md:text-3xl">{category.icon}</span>
          <div>
            <h3 className="font-semibold text-base md:text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {category.name}
            </h3>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
              {category.count}개의 글
            </p>
          </div>
        </div>
        <Folder className="w-5 h-5 text-gray-400 dark:text-gray-600 group-hover:text-blue-500 transition-colors" />
      </div>
    </Link>
  );
}
