import Link from "next/link";
import type { CSSProperties } from "react";
import type { CategoryData } from "@/infra/db/types";
import { getCategoryColor, toCanonicalCategory } from "@/lib/category-meta";

interface CategoryCardProps {
  category: CategoryData;
}

export function CategoryCard({ category }: CategoryCardProps) {
  const catColor = getCategoryColor(category.slug);
  const canonical = toCanonicalCategory(category.slug);
  const inlineStyle = { "--cat-color": catColor } as CSSProperties;

  return (
    <Link
      href={`/category/${encodeURIComponent(category.slug)}`}
      style={inlineStyle}
      className="group relative block overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4 transition-[border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] md:p-5"
    >
      <span
        className="absolute inset-y-0 left-0 w-[2px] opacity-70 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: "var(--cat-color)" }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-2xl md:text-3xl">{category.icon}</span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight text-[var(--color-fg-primary)] transition-colors duration-150 group-hover:text-[var(--color-brand-400)] md:text-lg">
              {category.name}
            </h3>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--color-fg-muted)]">
              {category.count.toLocaleString()} posts
            </p>
          </div>
        </div>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.06em]"
          style={{ color: "var(--cat-color)" }}
        >
          {canonical}
        </span>
      </div>
    </Link>
  );
}
