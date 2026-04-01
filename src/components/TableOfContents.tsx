"use client";

import { useEffect, useState } from "react";
import { TocItem } from "@/lib/markdown";
import { List, ChevronDown } from "lucide-react";

interface TableOfContentsProps {
  toc: TocItem[];
}

const STORAGE_KEY = "toc-collapsed";

export function TableOfContents({ toc }: TableOfContentsProps) {
  const [activeSlug, setActiveSlug] = useState<string>("");
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "true") {
      setIsCollapsed(true);
    }
  }, []);

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

  function toggle() {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (next) {
        localStorage.setItem(STORAGE_KEY, "true");
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      return next;
    });
  }

  return (
    <nav className="sticky top-24 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <button
        onClick={toggle}
        aria-expanded={!isCollapsed}
        aria-controls="toc-content"
        className="w-full flex items-center justify-between gap-2 p-4 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span className="flex items-center gap-2">
          <List className="w-4 h-4" />
          목차
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
            isCollapsed ? "" : "rotate-180"
          }`}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: isCollapsed ? "0fr" : "1fr" }}
      >
        <ul
          id="toc-content"
          className="overflow-hidden space-y-2 text-sm px-4"
          style={{ paddingBottom: isCollapsed ? 0 : "1rem" }}
        >
          {toc.map((item, index) => (
            <li
              key={`${item.slug}-${index}`}
              style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
            >
              <a
                href={`#${item.slug}`}
                className={`block py-1 transition-colors ${
                  activeSlug === item.slug
                    ? "text-blue-600 dark:text-blue-400 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
