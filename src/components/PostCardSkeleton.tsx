export function PostCardSkeleton() {
  return (
    <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse">
      <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="flex-grow min-w-0 space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
      <div className="flex-shrink-0 w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );
}
