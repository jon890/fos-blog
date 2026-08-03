export function PostCardSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-[112px_minmax(0,1fr)] items-center gap-4 border-t border-[var(--color-border-subtle)] py-5 md:grid-cols-[160px_minmax(0,1fr)_180px_100px] md:gap-6 md:py-6">
      <div className="aspect-video w-full rounded-md bg-[var(--color-bg-overlay)]" />
      <div className="space-y-2 min-w-0">
        <div className="h-4 w-3/4 rounded bg-[var(--color-bg-overlay)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--color-bg-overlay)]" />
      </div>
      <div className="hidden h-3 w-20 rounded bg-[var(--color-bg-overlay)] md:block" />
      <div className="hidden h-3 w-16 rounded bg-[var(--color-bg-overlay)] md:block" />
    </div>
  );
}
