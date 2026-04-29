import Link from "next/link";
import type { CSSProperties } from "react";
import { getCategoryColor } from "@/lib/category-meta";
import { formatYYYYMMDD, formatRelativeKo } from "@/lib/time";

interface PostListRowProps {
  index: number;
  title: string;
  excerpt: string;
  href: string;
  updatedAt: Date | null;
  readingMinutes?: number;
  categorySlug: string;
}

export function PostListRow({
  index,
  title,
  excerpt,
  href,
  updatedAt,
  readingMinutes,
  categorySlug,
}: PostListRowProps) {
  const catColor = getCategoryColor(categorySlug);
  const numStr = `— ${String(index).padStart(3, "0")}`;

  return (
    <Link
      href={href}
      className="post-list-row grid grid-cols-[60px_1fr_90px] gap-6 py-4.5 pl-4 border-b border-[var(--color-border-subtle)] items-center cursor-pointer relative border-l-2 border-l-transparent transition-[border-left-color,background] duration-150"
      style={{ "--cat-color": catColor } as CSSProperties}
    >
      <span className="font-mono text-[11px] tracking-[0.04em] text-[var(--color-fg-faint)]">
        {numStr}
      </span>

      <div>
        <p className="text-[15px] font-medium tracking-[-0.01em] text-[var(--color-fg-primary)] leading-[1.4] mb-1">
          {title}
        </p>
        {excerpt && (
          <p className="text-[13px] text-[var(--color-fg-secondary)] line-clamp-1">{excerpt}</p>
        )}
      </div>

      <div className="font-mono text-[11px] text-[var(--color-fg-muted)] text-right">
        <span>{formatYYYYMMDD(updatedAt)}</span>
        <br />
        <span>
          {readingMinutes ? `${readingMinutes} min` : formatRelativeKo(updatedAt)}
        </span>
      </div>
    </Link>
  );
}
