import Link from "next/link";

interface ArticleFooterProps {
  tags?: string[];
  series?: string | null;
  prevInSeries?: { title: string; slug: string } | null;
  nextInSeries?: { title: string; slug: string } | null;
}

export function ArticleFooter({
  tags,
  series,
  prevInSeries,
  nextInSeries,
}: ArticleFooterProps) {
  const hasTags = tags && tags.length > 0;
  const hasNav = prevInSeries || nextInSeries;

  if (!hasTags && !series && !hasNav) return null;

  return (
    <footer className="mx-auto mt-16 max-w-[880px] border-t border-[var(--color-border-subtle)] px-6 py-12">
      {(hasTags || series) && (
        <>
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
            tags
          </div>
          <div className="flex flex-wrap gap-2">
            {hasTags &&
              tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tag/${encodeURIComponent(tag)}`}
                  className="rounded border border-[var(--color-border-subtle)] px-2.5 py-1 font-mono text-[11px] tracking-tight text-[var(--color-fg-secondary)] transition-colors hover:border-[var(--color-brand-400)] hover:text-[var(--color-brand-400)]"
                >
                  #{tag}
                </Link>
              ))}
            {series && (
              <Link
                href={`/series/${encodeURIComponent(series)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-1 font-mono text-[13px] transition-colors hover:border-[var(--color-brand-400)]"
              >
                📚 {series}
              </Link>
            )}
          </div>
        </>
      )}

      {hasNav && (
        <nav
          aria-label="In this series"
          className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {prevInSeries ? (
            <Link
              href={`/posts/${prevInSeries.slug.split("/").map(encodeURIComponent).join("/")}`}
              className="block rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-5 transition-colors hover:border-[var(--color-brand-400)]"
            >
              <span className="mb-1 block font-mono text-[11px] tracking-wider text-[var(--color-fg-muted)]">
                ← PREVIOUS
              </span>
              <span className="block line-clamp-2 text-[14px] font-medium text-[var(--color-fg-primary)]">
                {prevInSeries.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
          {nextInSeries ? (
            <Link
              href={`/posts/${nextInSeries.slug.split("/").map(encodeURIComponent).join("/")}`}
              className="block rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-5 text-right transition-colors hover:border-[var(--color-brand-400)]"
            >
              <span className="mb-1 block font-mono text-[11px] tracking-wider text-[var(--color-fg-muted)]">
                NEXT →
              </span>
              <span className="block line-clamp-2 text-[14px] font-medium text-[var(--color-fg-primary)]">
                {nextInSeries.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
        </nav>
      )}
    </footer>
  );
}
