import Link from "next/link";
import type { CSSProperties } from "react";
import type { CategoryData } from "@/infra/db/types";
import { getCategoryColor, toCanonicalCategory } from "@/lib/category-meta";
import { formatRelativeKo } from "@/lib/time";

interface CategoryFeaturedProps {
  category: CategoryData;
  rank: number;
  latestUpdatedAt: Date | null;
}

export function CategoryFeatured({ category, rank, latestUpdatedAt }: CategoryFeaturedProps) {
  const catColor = getCategoryColor(category.slug);
  const canonical = toCanonicalCategory(category.slug);
  const rankStr = `#${String(rank).padStart(2, "0")}`;

  const inlineStyle = {
    "--cat-color": catColor,
    background: `linear-gradient(to bottom right, color-mix(in oklch, var(--cat-color), transparent 92%) 0%, transparent 60%), var(--color-bg-elevated)`,
    borderLeftColor: "var(--cat-color)",
  } as CSSProperties;

  return (
    <Link
      href={`/category/${encodeURIComponent(category.slug)}`}
      style={inlineStyle}
      className="group relative flex flex-col min-h-[220px] rounded-lg border border-[var(--color-border-subtle)] border-l-2 p-7 pb-6 transition-[transform,border-color] duration-[var(--duration-default)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[var(--cat-color)] motion-reduce:transform-none motion-reduce:transition-none"
    >
      <span
        className="absolute top-3.5 right-4 font-mono text-[10px] tracking-[0.1em] text-[var(--color-fg-faint)]"
        aria-hidden
      >
        {rankStr}
      </span>

      <div className="flex items-center gap-2.5">
        <span
          className="grid place-items-center w-9 h-9 rounded-md text-lg flex-none"
          style={{
            background: "color-mix(in oklch, var(--cat-color), transparent 88%)",
            border: "1px solid color-mix(in oklch, var(--cat-color), transparent 70%)",
            color: "var(--cat-color)",
          }}
        >
          {category.icon}
        </span>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.1em]"
          style={{ color: "var(--cat-color)" }}
        >
          {canonical}
        </span>
      </div>

      <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.018em] text-[var(--color-fg-primary)]">
        {category.name}
      </h3>

      <div className="flex-1" />

      <div className="mt-auto pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between font-mono text-[11px]">
        <span>
          <span className="text-[var(--color-fg-primary)] font-medium text-[16px]">
            {category.count}
          </span>
          {" "}posts
        </span>
        <span className="text-[var(--color-fg-muted)]">
          최근 업데이트{" "}
          <span className="text-[var(--color-fg-secondary)]">{formatRelativeKo(latestUpdatedAt)}</span>
        </span>
      </div>
    </Link>
  );
}
