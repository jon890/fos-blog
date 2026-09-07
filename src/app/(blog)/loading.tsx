export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="animate-pulse">
        {/* Hero skeleton */}
        <div className="text-center mb-16">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto mb-6" />
          <div className="h-12 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg mx-auto mb-4" />
          <div className="h-6 w-96 max-w-full bg-gray-200 dark:bg-gray-800 rounded-lg mx-auto" />
        </div>

        {/* Categories skeleton */}
        <div className="mb-16">
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded-lg mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gray-200 dark:bg-gray-800 rounded-xl"
              />
            ))}
          </div>
        </div>

        {/* Posts skeleton */}
        <div>
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded-lg mb-8" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-20 bg-gray-200 dark:bg-gray-800 rounded-xl"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
