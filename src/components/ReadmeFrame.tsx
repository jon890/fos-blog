import type { CSSProperties, ReactNode } from "react";
import { getCategoryColor } from "@/lib/category-meta";

interface ReadmeFrameProps {
  filename?: string;
  ext?: string;
  categorySlug: string;
  children: ReactNode;
}

export function ReadmeFrame({
  filename = "README",
  ext = ".md",
  categorySlug,
  children,
}: ReadmeFrameProps) {
  const catColor = getCategoryColor(categorySlug);

  return (
    <div
      style={{ "--cat-color": catColor } as CSSProperties}
      className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-[18px] py-3 border-b border-[var(--color-border-subtle)] bg-[color-mix(in_oklch,var(--color-bg-subtle),transparent_50%)] font-mono text-[12px]">
        <span className="text-[var(--color-fg-secondary)]">{filename}</span>
        <span className="text-[var(--color-fg-faint)] -ml-1">{ext}</span>
      </div>
      <div className="readme-body px-7 py-7">{children}</div>
    </div>
  );
}
