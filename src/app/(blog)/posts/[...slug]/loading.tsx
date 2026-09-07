export default function PostLoading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="animate-pulse">
        {/* Back button skeleton */}
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-800 rounded mb-8" />

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content skeleton */}
          <article className="flex-grow">
            {/* Header skeleton */}
            <div className="mb-8 pb-8 border-b border-gray-200 dark:border-gray-800">
              <div className="h-6 w-24 bg-gray-200 dark:bg-gray-800 rounded-full mb-4" />
              <div className="h-12 w-3/4 bg-gray-200 dark:bg-gray-800 rounded-lg mb-4" />
              <div className="h-5 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
            </div>

            {/* Content skeleton */}
            <div className="space-y-4">
              <div className="h-6 w-full bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="h-6 w-5/6 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="h-6 w-4/5 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="h-32 w-full bg-gray-200 dark:bg-gray-800 rounded-lg mt-6" />
              <div className="h-6 w-full bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
            </div>
          </article>

          {/* Sidebar skeleton */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          </aside>
        </div>
      </div>
    </div>
  );
}
