import Link from "next/link";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "@/db/constants";
import type { PostData } from "@/db/types";
import { FileText, ChevronRight, Eye } from "lucide-react";

interface PostCardProps {
  post: PostData;
  showCategory?: boolean;
  viewCount?: number;
}

const CATEGORY_DOT: Record<string, string> = {
  java:         "bg-amber-400",
  AI:           "bg-purple-400",
  database:     "bg-orange-400",
  devops:       "bg-red-400",
  javascript:   "bg-yellow-400",
  react:        "bg-cyan-400",
  algorithm:    "bg-green-400",
  architecture: "bg-blue-400",
  interview:    "bg-pink-400",
  network:      "bg-indigo-400",
  kafka:        "bg-rose-400",
  internet:     "bg-teal-400",
};

function getCategoryIcon(category: string): string {
  return categoryIcons[category] || DEFAULT_CATEGORY_ICON;
}

export function PostCard({
  post,
  showCategory = true,
  viewCount,
}: PostCardProps) {
  const dot = CATEGORY_DOT[post.category] ?? "bg-gray-400";

  return (
    <Link
      href={`/posts/${post.slug.split("/").map(encodeURIComponent).join("/")}`}
      className="group flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all duration-300"
    >
      <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
        <FileText className="w-4 h-4 md:w-5 md:h-5 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
      </div>

      <div className="flex-grow min-w-0">
        <h3 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {post.title}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          {showCategory && (
            <>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
              <span className="text-sm">{getCategoryIcon(post.category)}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {post.category}
                {post.subcategory && ` / ${post.subcategory}`}
              </span>
            </>
          )}
          {viewCount !== undefined && (
            <>
              {showCategory && (
                <span className="text-gray-300 dark:text-gray-600">·</span>
              )}
              <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                <Eye className="w-3.5 h-3.5" />
                {viewCount.toLocaleString()}
              </span>
            </>
          )}
        </div>
      </div>

      <ChevronRight className="flex-shrink-0 w-5 h-5 text-gray-400 dark:text-gray-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
    </Link>
  );
}
