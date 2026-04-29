import type { CSSProperties } from "react";
import { getCategoryColor } from "@/lib/category-meta";
import { type SublinePart, isSublinePart } from "@/lib/subline";

interface CategoryDetailSubHeroProps {
  eyebrow: string;
  title: string;
  sublines: ReadonlyArray<string | SublinePart>;
  categorySlug: string;
}

export function CategoryDetailSubHero({
  eyebrow,
  title,
  sublines,
  categorySlug,
}: CategoryDetailSubHeroProps) {
  const catColor = getCategoryColor(categorySlug);

  const inlineStyle = {
    "--cat-color": catColor,
    borderLeftColor: catColor,
    background: `linear-gradient(to right, color-mix(in oklch, var(--cat-color), transparent 95%) 0%, transparent 40%)`,
  } as CSSProperties;

  return (
    <header
      style={inlineStyle}
      className="border-b border-[var(--color-border-subtle)] border-l-2 py-14 md:pt-14 md:pb-10"
    >
      <div className="mx-auto max-w-[1180px] px-8">
        <div className="flex flex-col gap-1">
          <span
            className="block h-px w-6 flex-none"
            style={{ background: "var(--cat-color)" }}
            aria-hidden
          />
          <p
            className="font-mono text-[11px] uppercase tracking-[0.08em]"
            style={{ color: "var(--cat-color)" }}
          >
            {eyebrow}
          </p>
        </div>
        <h1
          className="mt-5 font-semibold leading-[1.1] tracking-[-0.025em] text-[var(--color-fg-primary)]"
          style={{ fontSize: "clamp(36px,4vw,52px)" }}
        >
          {title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-[13px] text-[var(--color-fg-muted)]">
          {sublines.map((item, i) => (
            <span key={i} className="flex items-center gap-3">
              {i > 0 && (
                <span className="text-[var(--color-fg-faint)] select-none">·</span>
              )}
              {isSublinePart(item) ? (
                <span>
                  <span className="text-[var(--color-fg-primary)] font-medium">{item.num}</span>
                  {item.suffix}
                </span>
              ) : (
                <span className="text-[var(--color-fg-faint)]">{item}</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
