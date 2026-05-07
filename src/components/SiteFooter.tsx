import Link from "next/link";
import type { CSSProperties } from "react";
import { Github, Code2, Rss, Mail } from "lucide-react";
import { VisitorCount } from "./VisitorCount";
import { getCategoryColor } from "@/lib/category-meta";

const FOOTER_CATEGORIES = [
  { id: "ai",        label: "AI" },
  { id: "algorithm", label: "Algorithm" },
  { id: "db",        label: "DB" },
  { id: "devops",    label: "DevOps" },
  { id: "java",      label: "Java/Spring" },
  { id: "js",        label: "JS/TS" },
  { id: "react",     label: "React" },
  { id: "next",      label: "Next.js" },
  { id: "system",    label: "System" },
] as const;

const SITE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/posts/latest", label: "Posts" },
  { href: "/categories", label: "Categories" },
  { href: "/about", label: "About" },
];

const POLICY_LINKS = [
  { href: "/about", label: "소개", path: "/about" },
  { href: "/privacy", label: "개인정보처리방침", path: "/privacy" },
  { href: "/contact", label: "연락처", path: "/contact" },
];

const BUILD_DATE = "2026.04.27"; // build time stamp — package 또는 env 로 동적화 가능 (별도 issue)

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="fbf relative overflow-hidden border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]">
      {/* Top accent line */}
      <div aria-hidden className="fbf-accent absolute top-0 left-0 right-0 h-px" />

      {/* Mesh accent (subtle) */}
      <div
        aria-hidden
        className="fbf-mesh pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(40% 80% at 10% 0%, oklch(0.7 0.16 230 / 0.45), transparent 60%), radial-gradient(40% 70% at 90% 0%, oklch(0.65 0.18 280 / 0.32), transparent 60%), radial-gradient(35% 60% at 50% 100%, oklch(0.78 0.13 195 / 0.40), transparent 60%)",
          filter: "blur(40px) saturate(140%)",
        }}
      />
      {/* Grid lines */}
      <div
        aria-hidden
        className="fbf-grid pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(to right, var(--color-border-subtle) 1px, transparent 1px)",
          backgroundSize: "80px 100%",
          maskImage: "linear-gradient(to bottom, transparent, black 30%, black 90%)",
        }}
      />

      <div className="relative z-[2] mx-auto max-w-[1280px] px-6 pt-16 pb-7 md:px-8">
        {/* Eyebrow */}
        <div className="fbf-eyebrow flex flex-col gap-3 border-b border-[var(--color-border-subtle)] pb-7 mb-10 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] md:flex-row md:items-center md:justify-between">
          <span className="inline-flex items-center gap-2.5 text-[var(--color-brand-400)]">
            <span aria-hidden className="block h-px w-6 bg-[var(--color-brand-400)]" />
            FOS-BLOG · FOOTER
          </span>
          <span className="inline-flex flex-wrap items-center gap-3.5 text-[var(--color-fg-faint)]">
            <span className="inline-flex items-center gap-2 text-[var(--color-fg-secondary)]">
              <span
                aria-hidden
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-success)]"
                style={{ boxShadow: "0 0 6px var(--color-success)" }}
              />
              all systems normal
            </span>
            <span className="hidden md:inline opacity-50">·</span>
            <span className="hidden md:inline">v0.1 · {BUILD_DATE}</span>
            <span className="hidden md:inline opacity-50">·</span>
            <span className="hidden md:inline">seoul, kr</span>
          </span>
        </div>

        {/* 4-column grid (모바일 1-col stack) */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.5fr_1fr_1fr_1.2fr] md:gap-8">
          {/* Brand col */}
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <span
                aria-hidden
                className="grid h-9 w-9 place-items-center rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] font-mono text-[14px] font-semibold text-[var(--color-brand-400)]"
                style={{ boxShadow: "inset 0 1px 0 0 rgb(255 255 255 / 0.04)" }}
              >
                F
              </span>
              <span className="font-mono text-[14px] tracking-tight text-[var(--color-fg-primary)]">
                fos-blog<span className="text-[var(--color-fg-muted)]">/study</span>
              </span>
            </Link>
            <p className="mt-4 max-w-[36ch] text-[13px] leading-relaxed text-[var(--color-fg-secondary)]">
              개발 학습 기록을 정리하는 블로그입니다. 공부하면서 기록하고, 기록하면서 다시 배웁니다.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 font-mono text-[11px]">
              <span className="text-[var(--color-fg-muted)] uppercase tracking-[0.06em]">visitors</span>
              <span className="text-[var(--color-brand-400)] tabular-nums">
                <VisitorCount />
              </span>
            </div>
          </div>

          {/* Site + Policy col */}
          <div>
            <ColHead idx="01" label="site" />
            <FooterList
              items={SITE_LINKS.map((l) => ({ href: l.href, label: l.label, arrow: "↗" }))}
            />
            <div className="mt-8" />
            <ColHead idx="02" label="policy" />
            <FooterList
              items={POLICY_LINKS.map((l) => ({ href: l.href, label: l.label, arrow: l.path, arrowMono: true }))}
            />
          </div>

          {/* Categories col */}
          <div>
            <ColHead idx="03" label="categories" />
            <ul className="space-y-2">
              {FOOTER_CATEGORIES.map((c) => {
                const color = getCategoryColor(c.id);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/categories#${c.id}`}
                      style={{ "--cat-color": color } as CSSProperties}
                      className="group flex items-center gap-2.5 text-[13px] text-[var(--color-fg-secondary)] transition-colors hover:text-[var(--color-fg-primary)]"
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: "var(--cat-color)" }}
                      />
                      <span>{c.label}</span>
                      <span className="ml-auto font-mono text-[11px] text-[var(--color-fg-faint)] opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-[var(--color-brand-400)]">
                        ↗
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Connect col */}
          <div>
            <ColHead idx="04" label="connect" />
            <ul className="space-y-3">
              <SocialItem
                href="https://github.com/jon890"
                external
                Icon={Github}
                ttl="GitHub"
                sub="@jon890"
                arrow="↗"
              />
              <SocialItem
                href="https://github.com/jon890/fos-study"
                external
                Icon={Code2}
                ttl="Source repository"
                sub="jon890/fos-study"
                arrow="↗"
              />
              <SocialItem
                href="/rss.xml"
                Icon={Rss}
                ttl="RSS feed"
                sub="/rss.xml"
                arrow="↗"
              />
              <SocialItem
                href="#newsletter"
                Icon={Mail}
                ttl="Newsletter"
                sub="매주 1 회 · 한 편의 글"
                arrow="→"
                disabled // 미구현 — 별도 issue.
              />
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-7 font-mono text-[11px] text-[var(--color-fg-muted)] md:flex-row md:items-center md:justify-between">
          <div className="copy">
            © {year} <strong className="font-semibold text-[var(--color-fg-primary)]">FOS Study</strong>. All posts MIT-licensed.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>built with</span>
            {["Next.js", "Tailwind v4", "Geist", "Pretendard", "oklch"].map((s) => (
              <span key={s} className="inline-flex items-center gap-2">
                <span className="opacity-50">·</span>
                <span>{s}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function ColHead({ idx, label }: { idx: string; label: string }) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)]">
      <span className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[var(--color-fg-faint)]">
        {idx}
      </span>
      <span>{label}</span>
    </div>
  );
}

interface FooterItem {
  href: string;
  label: string;
  arrow: string;
  arrowMono?: boolean;
}
function FooterList({ items }: { items: FooterItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={`${it.href}-${it.label}`}>
          <Link
            href={it.href}
            className="group flex items-center justify-between gap-3 text-[13px] text-[var(--color-fg-secondary)] transition-colors hover:text-[var(--color-fg-primary)]"
          >
            <span>{it.label}</span>
            <span
              className={`text-[var(--color-fg-faint)] opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-[var(--color-brand-400)] ${it.arrowMono ? "font-mono text-[10px]" : ""}`}
            >
              {it.arrow}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface SocialItemProps {
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  ttl: string;
  sub: string;
  arrow: string;
  external?: boolean;
  disabled?: boolean;
}
function SocialItem({ href, Icon, ttl, sub, arrow, external, disabled }: SocialItemProps) {
  const className =
    "group flex items-center gap-3 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2.5 transition-colors hover:border-[var(--color-border-default)] hover:bg-[var(--color-bg-overlay)]" +
    (disabled ? " pointer-events-none opacity-40" : "");
  const inner = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)] group-hover:text-[var(--color-brand-400)]" />
      <span className="flex flex-1 flex-col">
        <span className="text-[13px] text-[var(--color-fg-primary)]">{ttl}</span>
        <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">{sub}</span>
      </span>
      <span className="font-mono text-[12px] text-[var(--color-fg-faint)] group-hover:text-[var(--color-brand-400)]">
        {arrow}
      </span>
    </>
  );

  return (
    <li>
      {disabled ? (
        <span className={className} aria-disabled="true" title="준비 중">
          {inner}
        </span>
      ) : external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
          {inner}
        </a>
      ) : (
        <Link href={href} className={className}>
          {inner}
        </Link>
      )}
    </li>
  );
}
