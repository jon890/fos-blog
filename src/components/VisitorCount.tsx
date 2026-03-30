"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";

interface VisitorData {
  totalCount: number;
  todayCount: number;
}

export function VisitorCount() {
  const [data, setData] = useState<VisitorData | null>(null);

  useEffect(() => {
    const fetchVisitorCount = async () => {
      try {
        const res = await fetch("/api/visit?total=true");
        if (res.ok) {
          const json = await res.json();
          setData({
            totalCount: json.totalCount,
            todayCount: json.todayCount,
          });
        }
      } catch {
        // 실패해도 UI에 영향 없음
      }
    };

    fetchVisitorCount();
  }, []);

  if (!data) return null;

  return (
    <div className="flex items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
      <div className="flex items-center gap-1.5">
        <Users className="w-4 h-4" />
        <span>
          전체 <strong className="text-gray-700 dark:text-gray-300">{data.totalCount.toLocaleString()}</strong>
        </span>
      </div>
      <span className="text-gray-300 dark:text-gray-600">|</span>
      <div>
        <span>
          오늘 <strong className="text-gray-700 dark:text-gray-300">{data.todayCount.toLocaleString()}</strong>
        </span>
      </div>
    </div>
  );
}
