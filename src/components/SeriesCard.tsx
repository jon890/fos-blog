import Link from "next/link";
import type { CSSProperties } from "react";
import type { SeriesInfo } from "@/infra/db/types";
import { getCategoryColor, toCanonicalCategory } from "@/lib/category-meta";

interface SeriesCardProps {
  series: SeriesInfo;
}

function seriesHref(name: string): string {
  return `/series/${encodeURIComponent(name)}`;
}

function formatDate(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export function SeriesCard({ series }: SeriesCardProps) {
  const catColor = getCategoryColor(series.firstPost.category);
  const canonical = toCanonicalCategory(series.firstPost.category);
  const inlineStyle = { "--cat-color": catColor } as CSSProperties;

  return (
    <Link
      href={seriesHref(series.name)}
      style={inlineStyle}
      className="group flex flex-col overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] transition-[border-color,transform] duration-[var(--duration-default)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.06em]">
          <span className="flex items-center gap-2" style={{ color: "var(--cat-color)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            <span>{canonical}</span>
          </span>
          <span className="text-[var(--color-fg-muted)]">{series.postCount} posts</span>
        </div>
        <h3 className="text-[17px] font-medium leading-snug tracking-tight text-[var(--color-fg-primary)] line-clamp-2">
          {series.name}
        </h3>
        {series.firstPost.description && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--color-fg-secondary)]">
            {series.firstPost.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-3 font-mono text-[11px] text-[var(--color-fg-muted)]">
          <span>{formatDate(series.latestUpdatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
