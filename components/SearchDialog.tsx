"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, FileText, Loader2 } from "lucide-react";

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
  const router = useRouter();

  // 검색 실행
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&limit=10`
      );
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 디바운스 검색
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // ESC 키로 닫기
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

  // 결과 클릭
  const handleResultClick = (path: string) => {
    onClose();
    setQuery("");
    setResults([]);
    router.push(`/posts/${path.split("/").map(encodeURIComponent).join("/")}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="게시글 검색..."
            className="flex-1 bg-transparent text-lg outline-none placeholder:text-gray-400 text-gray-900 dark:text-white"
            autoFocus
          />
          {isLoading && (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query && results.length === 0 && !isLoading && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              검색 결과가 없습니다.
            </div>
          )}

          {results.length > 0 && (
            <ul className="py-2">
              {results.map((result) => (
                <li key={result.path}>
                  <button
                    onClick={() => handleResultClick(result.path)}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {result.title}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
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

          {!query && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p className="text-sm">제목, 내용, 설명에서 검색합니다.</p>
              <p className="text-xs mt-2">
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">
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
