import type { ReactNode } from "react";

interface CategoriesSectionProps {
  idx: string;
  title: string;
  meta: string;
  children: ReactNode;
}

export function CategoriesSection({ idx, title, meta, children }: CategoriesSectionProps) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-5 pb-3.5 border-b border-[var(--color-border-subtle)]">
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--color-fg-primary)]">
          <span className="font-mono text-[11px] text-[var(--color-fg-faint)] tracking-[0.08em] font-normal mr-3">
            {idx}
          </span>
          {title}
        </h2>
        <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">{meta}</span>
      </div>
      {children}
    </section>
  );
}
