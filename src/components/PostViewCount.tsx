"use client";

import { useState, useEffect } from "react";
import { Eye } from "lucide-react";

interface PostViewCountProps {
  pagePath: string;
  className?: string;
}

/**
 * 특정 포스트의 조회수를 표시하는 클라이언트 컴포넌트
 */
export function PostViewCount({
  pagePath,
  className = "",
}: PostViewCountProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch(
          `/api/visit?path=${encodeURIComponent(pagePath)}`
        );
        if (res.ok) {
          const data = await res.json();
          setCount(data.count);
        }
      } catch {
        // 실패해도 UI에 영향 없음
      }
    };

    fetchCount();
  }, [pagePath]);

  if (count === null) return null;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Eye className="w-4 h-4" />
      <span>{count.toLocaleString()}회</span>
    </div>
  );
}
