"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { SearchDialog } from "./SearchDialog";
import { Book, Github, Home, Menu, X, Search, PanelLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useSidebar } from "./SidebarContext";
import type { CSSProperties } from "react";

export function Header() {
  const pathname = usePathname();
  const { toggle: toggleSidebar } = useSidebar();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isArticle = pathname?.startsWith("/posts/");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isArticle) {
      setProgress(0);
      return;
    }
    const onScroll = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isArticle]);

  // Cmd/Ctrl + K 단축키로 검색 열기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navLinks = [
    { href: "/", label: "01 / 홈", icon: Home },
    { href: "/categories", label: "02 / 카테고리", icon: Book },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--color-bg-base)]/80 backdrop-blur-md saturate-150">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Brand mark */}
          <Link
            href="/"
            className="brand-mark flex items-center gap-2 font-mono text-[14px] tracking-tight text-[var(--color-fg-primary)] hover:text-[var(--color-brand-400)] transition-colors"
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full bg-[var(--color-brand-400)]"
              style={{ boxShadow: "0 0 8px var(--color-brand-400)" }}
            />
            fos-blog<span className="text-[var(--color-fg-muted)]">/study</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 font-mono text-[12px] transition-colors ${
                    isActive(link.href)
                      ? "text-[var(--color-brand-400)]"
                      : "text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Sidebar Toggle */}
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              aria-label="폴더 사이드바 열기"
            >
              <PanelLeft className="w-5 h-5" />
            </button>

            {/* Search Button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-overlay)] transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">검색</span>
              <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-[var(--color-bg-overlay)] border border-[var(--color-border-subtle)] rounded">
                ⌘K
              </kbd>
            </button>

            <a
              href="https://github.com/jon890/fos-study"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
            <ThemeToggle />

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-[var(--color-fg-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileMenuOpen
              ? "max-h-48 py-4 border-t border-[var(--color-border-subtle)]"
              : "max-h-0"
          }`}
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 font-mono text-sm rounded-lg transition-colors ${
                  isActive(link.href)
                    ? "bg-[var(--color-bg-elevated)] text-[var(--color-brand-400)]"
                    : "text-[var(--color-fg-secondary)] hover:bg-[var(--color-bg-elevated)]"
                }`}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Search Dialog */}
      <SearchDialog isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Reading progress — replaces static border-b */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 h-px w-full bg-[var(--color-border-subtle)]"
      />
      {isArticle && (
        <div
          aria-hidden
          className="absolute bottom-0 left-0 h-px bg-[var(--color-brand-400)] transition-[width] duration-75 ease-linear"
          style={
            {
              width: `${progress * 100}%`,
              boxShadow: "0 0 8px var(--color-brand-400)",
            } as CSSProperties
          }
        />
      )}
    </header>
  );
}
