import Link from "next/link";
import type { CSSProperties } from "react";
import {
  getCategoryColor,
  getCategoryHue,
  toCanonicalCategory,
} from "@/lib/category-meta";

interface ArticleHeroProps {
  category: string;
  title: string;
  description: string;
  createdAt: Date | null;
  readTimeMinutes: number;
  viewCount: number;
  breadcrumb: { label: string; href?: string }[];
}

export function ArticleHero({
  category,
  title,
  description,
  createdAt,
  readTimeMinutes,
  viewCount,
  breadcrumb,
}: ArticleHeroProps) {
  const catColor = getCategoryColor(category);
  const catHue = getCategoryHue(category);
  const canonical = toCanonicalCategory(category);
  const inlineStyle = {
    "--cat-color": catColor,
    "--mesh-stop-cat": `oklch(0.7 0.16 ${catHue})`,
  } as CSSProperties;

  const dateStr = createdAt
    ? `${createdAt.getFullYear()}.${String(createdAt.getMonth() + 1).padStart(2, "0")}.${String(createdAt.getDate()).padStart(2, "0")}`
    : "";

  return (
    <header
      className="relative overflow-hidden border-b border-[var(--color-border-subtle)] px-6 pt-8 pb-12 md:pt-16 md:pb-14"
      style={inlineStyle}
    >
      {/* Mesh gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 blur-[40px] saturate-[140%]"
        style={{
          background:
            "radial-gradient(60% 80% at 20% 20%, color-mix(in oklch, var(--mesh-stop-cat) 45%, transparent), transparent 60%), radial-gradient(50% 70% at 80% 30%, color-mix(in oklch, var(--mesh-stop-03) 32%, transparent), transparent 60%), radial-gradient(50% 70% at 50% 80%, color-mix(in oklch, var(--mesh-stop-02) 35%, transparent), transparent 60%)",
        }}
      />
      {/* 80px grid mask */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-border-subtle) 1px, transparent 1px)",
          backgroundSize: "80px 100%",
          maskImage:
            "linear-gradient(to bottom, transparent, black 30%, black 80%, transparent)",
        }}
      />

      <div className="relative z-[2] mx-auto max-w-[880px]">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="mb-6 flex items-center gap-2 font-mono text-[12px] text-[var(--color-fg-muted)]"
        >
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && (
                <span className="text-[var(--color-fg-faint)]">/</span>
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  className="hover:text-[var(--color-fg-primary)]"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-[var(--color-fg-primary)]">
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </nav>

        {/* Category art-tag */}
        <span
          className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em]"
          style={{
            color: "var(--cat-color)",
            borderColor: "var(--cat-color)",
            background: "color-mix(in oklch, var(--cat-color), transparent 90%)",
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          {canonical}
        </span>

        <h1 className="mt-6 mb-5 max-w-[22ch] text-[34px] font-semibold leading-[1.1] tracking-tight text-[var(--color-fg-primary)] md:text-[52px]">
          {title}
        </h1>

        {description && (
          <p className="mb-4 max-w-[56ch] text-[16px] leading-relaxed text-[var(--color-fg-secondary)] md:text-[18px]">
            {description}
          </p>
        )}

        {/* Meta row */}
        <div className="mt-6 flex flex-wrap items-center gap-3 font-mono text-[12px] text-[var(--color-fg-muted)]">
          {dateStr && <span>{dateStr}</span>}
          {dateStr && (
            <span className="text-[var(--color-fg-faint)]">·</span>
          )}
          <span>{readTimeMinutes} min read</span>
          <span className="text-[var(--color-fg-faint)]">·</span>
          <span>{viewCount.toLocaleString()} views</span>
        </div>
      </div>
    </header>
  );
}
