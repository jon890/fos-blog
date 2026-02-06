import Link from "next/link";
import {
  getDbQueries,
  categoryIcons,
  DEFAULT_CATEGORY_ICON,
} from "@/db/queries";
import type { PostData } from "@/db/types";
import { FileText, ChevronRight } from "lucide-react";

interface PostCardProps {
  post: PostData;
  showCategory?: boolean;
}

function getCategoryIcon(category: string): string {
  const dbQueries = getDbQueries();
  return (
    dbQueries?.getCategoryIcon(category) ??
    categoryIcons[category] ??
    DEFAULT_CATEGORY_ICON
  );
}

export function PostCard({ post, showCategory = true }: PostCardProps) {
  return (
    <Link
      href={`/posts/${post.slug.split("/").map(encodeURIComponent).join("/")}`}
      className="group flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all duration-300"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
        <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
      </div>

      <div className="flex-grow min-w-0">
        <h3 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {post.title}
        </h3>
        {showCategory && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm">{getCategoryIcon(post.category)}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {post.category}
              {post.subcategory && ` / ${post.subcategory}`}
            </span>
          </div>
        )}
      </div>

      <ChevronRight className="flex-shrink-0 w-5 h-5 text-gray-400 dark:text-gray-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
    </Link>
  );
}
