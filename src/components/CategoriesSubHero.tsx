import { type SublinePart, isSublinePart } from "@/lib/subline";

interface CategoriesSubHeroProps {
  eyebrow: string;
  title: string;
  sublines: Array<string | SublinePart>;
}

export function CategoriesSubHero({ eyebrow, title, sublines }: CategoriesSubHeroProps) {
  return (
    <header className="border-b border-[var(--color-border-subtle)] py-14 md:pt-14 md:pb-10">
      <div className="mx-auto max-w-[1180px] px-8">
        <div className="flex flex-col gap-1">
          <span className="block h-px w-6 bg-[var(--color-brand-400)]" aria-hidden />
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-brand-400)]">
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
                <span>{item}</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
