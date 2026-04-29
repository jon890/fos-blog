import Link from "next/link";
import { Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      aria-label="breadcrumb"
      className="mx-auto max-w-[1180px] px-8 pt-[18px] flex items-center gap-2 font-mono text-[12px] text-[var(--color-fg-muted)]"
    >
      <Home className="w-3 h-3 flex-none" aria-hidden />
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className="text-[var(--color-fg-faint)] select-none">/</span>
          {item.href ? (
            <Link
              href={item.href}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:text-[var(--color-fg-primary)] hover:bg-[var(--color-bg-subtle)]"
            >
              {item.label}
            </Link>
          ) : (
            <span className="px-2 py-1 text-[var(--color-fg-primary)] pointer-events-none">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
