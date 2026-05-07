import Link from "next/link";

interface ArticleFooterProps {
  tags?: string[];
}

export function ArticleFooter({ tags }: ArticleFooterProps) {
  if (!tags || tags.length === 0) return null;

  return (
    <footer className="mx-auto mt-16 max-w-[880px] border-t border-[var(--color-border-subtle)] px-6 py-12">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
        tags
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Link
            key={tag}
            href={`/tag/${encodeURIComponent(tag)}`}
            className="rounded border border-[var(--color-border-subtle)] px-2.5 py-1 font-mono text-[11px] tracking-tight text-[var(--color-fg-secondary)] transition-colors hover:border-[var(--color-brand-400)] hover:text-[var(--color-brand-400)]"
          >
            #{tag}
          </Link>
        ))}
      </div>
    </footer>
  );
}
