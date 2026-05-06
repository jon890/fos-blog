"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";
import { TocItem } from "@/lib/markdown";

const Z_FAB_LAYER = "z-40";
const Z_SHEET = "z-50";
const FAB_POSITION = "fixed bottom-6 right-6";
const SHEET_MAX_HEIGHT = "max-h-[70vh]";
const ICON_SIZE = 20;

interface MobileTocButtonProps {
  toc: TocItem[];
}

export function MobileTocButton({ toc }: MobileTocButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (toc.length === 0) return null;

  let h2Counter = 0;

  return (
    <div className="md:hidden">
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className={`${FAB_POSITION} ${Z_FAB_LAYER} flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand-400)] text-white shadow-lg`}
        aria-label="목차 열기"
      >
        <List size={ICON_SIZE} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className={`fixed inset-0 ${Z_FAB_LAYER} bg-black/40`}
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Bottom sheet */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="목차"
          className={`fixed inset-x-0 bottom-0 ${Z_SHEET} flex ${SHEET_MAX_HEIGHT} flex-col rounded-t-2xl bg-[var(--color-bg-elevated)] shadow-xl`}
        >
          {/* Handle */}
          <div className="flex items-center justify-center py-3">
            <div className="h-1 w-10 rounded-full bg-[var(--color-border-subtle)]" />
          </div>

          {/* Header */}
          <div className="px-5 pb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-fg-muted)]">
            on this page
          </div>

          {/* TOC list */}
          <ul className="overflow-y-auto px-5 pb-8 font-mono text-[12px]">
            {toc.map((item, idx) => {
              const isH3 = item.level === 3;
              if (!isH3) h2Counter++;
              const counter = isH3 ? null : h2Counter;
              return (
                <li key={`${item.slug}-${idx}`} className={isH3 ? "pl-4" : ""}>
                  <a
                    href={`#${item.slug}`}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-2 border-l py-1.5 pl-3 transition-colors duration-150 border-[var(--color-border-subtle)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-primary)] ${isH3 ? "text-[11px]" : ""}`}
                  >
                    {counter !== null && (
                      <span className="shrink-0 text-[var(--color-fg-faint)]">
                        {String(counter).padStart(2, "0")}
                      </span>
                    )}
                    <span className="leading-snug">{item.text}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
