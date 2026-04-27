"use client";

import { useEffect, useState } from "react";
import { TocItem } from "@/lib/markdown";

interface TableOfContentsProps {
  toc: TocItem[];
}

export function TableOfContents({ toc }: TableOfContentsProps) {
  const [activeSlug, setActiveSlug] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id);
          }
        });
      },
      { rootMargin: "-100px 0px -80% 0px" }
    );

    toc.forEach((item) => {
      const element = document.getElementById(item.slug);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [toc]);

  if (toc.length === 0) return null;

  return (
    <nav className="sticky top-20 font-mono text-[12px]">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-4 w-[3px] rounded-full bg-[var(--color-brand-400)]" aria-hidden />
        <span className="uppercase tracking-[0.1em] text-[var(--color-fg-muted)]">
          on this page
        </span>
      </div>

      <ul className="space-y-0">
        {toc.map((item, idx) => {
          const isActive = activeSlug === item.slug;
          return (
            <li key={`${item.slug}-${idx}`}>
              <a
                href={`#${item.slug}`}
                className={`flex items-start gap-2 border-l py-1.5 pl-3 transition-colors duration-150 ${
                  isActive
                    ? "border-[var(--color-brand-400)] font-medium text-[var(--color-brand-400)]"
                    : "border-[var(--color-border-subtle)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-primary)]"
                }`}
              >
                <span
                  className={`shrink-0 ${isActive ? "text-[var(--color-brand-400)]" : "text-[var(--color-fg-faint)]"}`}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="leading-snug">{item.text}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
