export default function CategoryLoading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="animate-pulse">
        {/* Back button skeleton */}
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-800 rounded mb-8" />

        {/* Header skeleton */}
        <div className="flex items-center gap-4 mb-12">
          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div>
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-2" />
            <div className="h-5 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        </div>

        {/* Posts skeleton */}
        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-gray-200 dark:bg-gray-800 rounded-xl"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
