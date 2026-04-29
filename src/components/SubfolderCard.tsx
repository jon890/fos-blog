import Link from "next/link";
import type { CSSProperties } from "react";
import { Folder, ArrowUpRight } from "lucide-react";
import { getCategoryColor } from "@/lib/category-meta";

interface SubfolderCardProps {
  name: string;
  href: string;
  count?: number;
  pathChip?: string;
  categorySlug: string;
}

export function SubfolderCard({ name, href, count, pathChip, categorySlug }: SubfolderCardProps) {
  const catColor = getCategoryColor(categorySlug);

  return (
    <Link
      href={href}
      style={
        {
          "--cat-color": catColor,
          borderLeftColor: catColor,
        } as CSSProperties
      }
      className="group relative flex items-start gap-3.5 overflow-hidden rounded-lg border border-[var(--color-border-subtle)] border-l-2 bg-[var(--color-bg-elevated)] p-[18px] pr-[16px] pb-4 transition-[transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--cat-color)]"
    >
      <span
        className="grid place-items-center w-9 h-9 rounded-md flex-none"
        style={{
          background: "color-mix(in oklch, var(--cat-color), transparent 90%)",
          border: "1px solid color-mix(in oklch, var(--cat-color), transparent 75%)",
          color: "var(--cat-color)",
        }}
      >
        <Folder className="w-4 h-4" />
      </span>

      <div className="flex-1 min-w-0">
        {pathChip && (
          <p className="font-mono text-[10px] tracking-[0.02em] text-[var(--color-fg-faint)] mb-1.5">
            <span className="text-[var(--color-fg-muted)]">{pathChip}</span>
          </p>
        )}
        <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-fg-primary)] truncate mb-1">
          {name}
        </p>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {count !== undefined && (
            <>
              <span className="text-[var(--color-fg-primary)] font-medium">{count}</span>
              <span className="text-[var(--color-fg-muted)]">posts</span>
            </>
          )}
          {pathChip && count !== undefined && (
            <>
              <span className="text-[var(--color-fg-faint)] select-none">·</span>
              <span className="text-[var(--color-fg-muted)]">nested</span>
            </>
          )}
        </div>
      </div>

      <ArrowUpRight
        className="absolute top-[18px] right-4 w-3.5 h-3.5 text-[var(--color-fg-faint)] transition-[color,transform] duration-200 group-hover:text-[var(--cat-color)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </Link>
  );
}
