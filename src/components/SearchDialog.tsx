"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, FileText, Loader2 } from "lucide-react";

const SEARCH_DEBOUNCE_MS = 300;

interface SearchResult {
  title: string;
  path: string;
  category: string;
  description?: string | null;
}

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const router = useRouter();

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&limit=10`
      );
      const data = await response.json();
      const newResults = data.results || [];
      setResults(newResults);
      setSelectedIndex(newResults.length > 0 ? 0 : -1);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
      setSelectedIndex(-1);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // ESC 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // 키보드 네비게이션 (ArrowDown/Up/Enter) — stale closure 방지를 위해 별도 effect
  useEffect(() => {
    const handleNavKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      } else if (e.key === "Enter") {
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          const path = results[selectedIndex].path;
          onClose();
          setQuery("");
          setResults([]);
          setSelectedIndex(-1);
          router.push(
            `/posts/${path.split("/").map(encodeURIComponent).join("/")}`
          );
        }
      }
    };

    document.addEventListener("keydown", handleNavKeyDown);
    return () => document.removeEventListener("keydown", handleNavKeyDown);
  }, [isOpen, results, selectedIndex, onClose, router]);

  // 선택 항목이 바뀌면 스크롤로 보이게
  useEffect(() => {
    if (selectedIndex >= 0 && resultRefs.current[selectedIndex]) {
      resultRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleResultClick = (path: string) => {
    onClose();
    setQuery("");
    setResults([]);
    setSelectedIndex(-1);
    router.push(`/posts/${path.split("/").map(encodeURIComponent).join("/")}`);
  };

  if (!isOpen) return null;

  const showSkeleton = isLoading && results.length === 0 && !!query.trim();

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]">
      {/* Backdrop — bg-black/50 고정. --color-bg-overlay 는 elevated surface 토큰이라 라이트 모드에서 불투명 연회색이 되어 scrim 으로 부적합 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl mx-4 bg-[var(--color-bg-elevated)] rounded-[12px] shadow-[var(--shadow-modal)] border border-[var(--color-border-subtle)] overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-[var(--color-border-subtle)]">
          <Search className="w-5 h-5 text-[var(--color-fg-faint)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="게시글 검색..."
            className="flex-1 bg-transparent text-lg outline-none placeholder:text-[var(--color-fg-faint)] text-[var(--color-fg-primary)]"
            autoFocus
          />
          {isLoading && (
            <Loader2 className="w-5 h-5 text-[var(--color-fg-faint)] animate-spin" />
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-bg-subtle)] transition-colors"
          >
            <X className="w-5 h-5 text-[var(--color-fg-faint)]" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Skeleton */}
          {showSkeleton && (
            <ul className="py-2">
              {[0, 1, 2].map((i) => (
                <li key={i} className="px-4 py-3">
                  <div className="bg-[var(--color-bg-subtle)] animate-pulse h-12 rounded" />
                </li>
              ))}
            </ul>
          )}

          {/* 빈 결과 */}
          {query && results.length === 0 && !isLoading && (
            <div className="p-8 text-center text-[var(--color-fg-muted)]">
              검색 결과가 없습니다.
            </div>
          )}

          {/* 결과 목록 */}
          {results.length > 0 && (
            <ul className="py-2">
              {results.map((result, idx) => (
                <li key={result.path}>
                  <button
                    ref={(el) => {
                      resultRefs.current[idx] = el;
                    }}
                    onClick={() => handleResultClick(result.path)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    data-selected={idx === selectedIndex}
                    className={`w-full px-4 py-3 flex items-start gap-3 transition-colors text-left ${
                      idx === selectedIndex
                        ? "bg-[var(--color-bg-subtle)]"
                        : "hover:bg-[var(--color-bg-subtle)]"
                    }`}
                  >
                    <FileText className="w-5 h-5 text-[var(--color-fg-faint)] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--color-fg-primary)] truncate">
                        {result.title}
                      </div>
                      <div className="text-sm text-[var(--color-fg-muted)] flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-[var(--color-bg-subtle)] text-[var(--color-fg-secondary)] rounded text-xs">
                          {result.category}
                        </span>
                        {result.description && (
                          <span className="truncate">{result.description}</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* 빈 쿼리 안내 */}
          {!query && (
            <div className="p-8 text-center text-[var(--color-fg-muted)]">
              <p className="text-sm">제목, 내용, 설명에서 검색합니다.</p>
              <p className="text-xs mt-2">
                <kbd className="px-2 py-1 bg-[var(--color-bg-subtle)] text-[var(--color-fg-secondary)] border border-[var(--color-border-subtle)] rounded text-xs">
                  ESC
                </kbd>{" "}
                로 닫기
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
