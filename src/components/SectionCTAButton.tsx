import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface SectionCTAButtonProps {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

export function SectionCTAButton({ href, label, icon }: SectionCTAButtonProps) {
  return (
    <div className="mt-8 flex justify-center">
      <Link
        href={href}
        className="group inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] px-4 py-2 font-mono text-[12px] tracking-tight text-[var(--color-fg-secondary)] transition-[color,border-color] duration-150 ease-out hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]"
      >
        {icon}
        <span>{label}</span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
