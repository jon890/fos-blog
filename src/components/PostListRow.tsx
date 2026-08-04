import Link from "next/link";
import type { CSSProperties } from "react";
import { getCategoryColor } from "@/lib/category-meta";
import { formatYYYYMMDD, formatRelativeKo } from "@/lib/time";
import { PostThumbnail } from "./PostThumbnail";

interface PostListRowProps {
  index: number;
  title: string;
  excerpt: string;
  href: string;
  updatedAt: Date | null;
  readingMinutes?: number;
  categorySlug: string;
  thumbnailUrl?: string | null;
}

export function PostListRow({
  index,
  title,
  excerpt,
  href,
  updatedAt,
  readingMinutes,
  categorySlug,
  thumbnailUrl,
}: PostListRowProps) {
  const catColor = getCategoryColor(categorySlug);
  const numStr = `— ${String(index).padStart(3, "0")}`;
  const mobileMeta = updatedAt
    ? `${formatYYYYMMDD(updatedAt)} · ${readingMinutes ? `${readingMinutes} min` : formatRelativeKo(updatedAt)}`
    : readingMinutes
      ? `${readingMinutes} min`
      : null;

  return (
    <Link
      href={href}
      className="group post-list-row relative grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4 border-b border-l-2 border-l-transparent border-[var(--color-border-subtle)] py-4.5 pl-4 transition-[border-left-color,background] duration-150 md:grid-cols-[60px_112px_minmax(0,1fr)_90px] md:gap-6"
      style={{ "--cat-color": catColor } as CSSProperties}
    >
      <span className="hidden font-mono text-[11px] tracking-[0.04em] text-[var(--color-fg-faint)] md:block">
        {numStr}
      </span>

      <PostThumbnail
        thumbnailUrl={thumbnailUrl}
        category={categorySlug}
        sizes="(min-width: 768px) 112px, 96px"
        className="aspect-video w-full rounded-md border border-[var(--color-border-subtle)]"
      />

      <div className="min-w-0">
        <p className="text-[15px] font-medium tracking-[-0.01em] text-[var(--color-fg-primary)] leading-[1.4] mb-1">
          {title}
        </p>
        {excerpt && (
          <p className="text-[13px] text-[var(--color-fg-secondary)] line-clamp-1">{excerpt}</p>
        )}
        {mobileMeta && (
          <div className="mt-2 font-mono text-[11px] text-[var(--color-fg-muted)] md:hidden">
            {mobileMeta}
          </div>
        )}
      </div>

      <div className="hidden text-right font-mono text-[11px] text-[var(--color-fg-muted)] md:block">
        <span>{formatYYYYMMDD(updatedAt)}</span>
        <br />
        <span>
          {readingMinutes ? `${readingMinutes} min` : formatRelativeKo(updatedAt)}
        </span>
      </div>
    </Link>
  );
}
