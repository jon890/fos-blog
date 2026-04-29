import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import type { CategoryData } from "@/infra/db/types";
import { getCategoryColor, toCanonicalCategory } from "@/lib/category-meta";

interface CategoryCardProps {
  category: CategoryData;
}

export function CategoryCard({ category }: CategoryCardProps) {
  const catColor = getCategoryColor(category.slug);
  const canonical = toCanonicalCategory(category.slug);

  return (
    <Link
      href={`/category/${encodeURIComponent(category.slug)}`}
      style={
        {
          "--cat-color": catColor,
          borderLeftColor: catColor,
        } as CSSProperties
      }
      className="cat-card group relative flex flex-col gap-2 overflow-hidden rounded-lg border border-[var(--color-border-subtle)] border-l-2 bg-[var(--color-bg-elevated)] p-[22px] pb-5 transition-[transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--cat-color)]"
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="grid place-items-center w-7 h-7 rounded-md text-base flex-none"
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

      <h3 className="text-[17px] font-semibold tracking-[-0.012em] text-[var(--color-fg-primary)]">
        {category.name}
      </h3>

      <div className="mt-3.5 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between font-mono text-[11px]">
        <span>
          <span className="text-[var(--color-fg-primary)] font-medium text-[13px]">
            {category.count}
          </span>
          {" "}posts
        </span>
        <span className="flex items-center gap-1 text-[var(--color-fg-muted)] transition-[color,gap] duration-150 group-hover:text-[var(--cat-color)] group-hover:gap-2">
          view <ArrowUpRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
}
