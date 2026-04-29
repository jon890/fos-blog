import { Flame } from "lucide-react";

interface PostsListSubHeroProps {
  eyebrow: string;
  title: string;
  meta: string;
  accent?: "default" | "popular";
}

export function PostsListSubHero({ eyebrow, title, meta, accent }: PostsListSubHeroProps) {
  return (
    <div className="py-10 md:py-14">
      <div className="flex items-center gap-3">
        <span className="h-px w-6 bg-[var(--color-brand-400)]" />
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-fg-muted)]">
          {eyebrow}
        </span>
      </div>

      <div className="mt-4 inline-flex items-center gap-3">
        <h1 className="text-[28px] md:text-[40px] font-semibold leading-[1.1] tracking-tight text-[var(--color-fg-primary)]">
          {title}
        </h1>
        {accent === "popular" && (
          <Flame
            className="h-6 md:h-7 w-auto"
            style={{ color: "var(--color-cat-algorithm)" }}
          />
        )}
      </div>

      <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
        {meta}
      </p>

      <div className="mt-8 h-px bg-[var(--color-border-subtle)]" />
    </div>
  );
}
