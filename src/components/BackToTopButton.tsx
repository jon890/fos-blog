"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

interface BackToTopButtonProps {
  variant: "floating" | "inline";
}

export function BackToTopButton({ variant }: BackToTopButtonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (variant !== "floating") return;

    function onScroll() {
      setVisible(window.scrollY > 300);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  function handleClick() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (variant === "floating" && !visible) return null;

  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

  const floatingCls = "fixed bottom-6 right-6 z-40 p-3 shadow-lg";
  const inlineCls = "px-4 py-2 mx-auto";

  return (
    <button
      onClick={handleClick}
      aria-label="맨 위로 이동"
      className={`${base} ${variant === "floating" ? floatingCls : inlineCls}`}
    >
      <ArrowUp className="w-5 h-5" />
      {variant === "inline" && <span>맨 위로</span>}
    </button>
  );
}
