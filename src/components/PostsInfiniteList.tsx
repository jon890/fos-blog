"use client";

import { useEffect, useRef, useState } from "react";
import type { PostData } from "@/infra/db/types";
import { PostCard } from "./PostCard";
import { PostCardSkeleton } from "./PostCardSkeleton";
import { BackToTopButton } from "./BackToTopButton";

const PAGE_SIZE = 10;

export type PostItem = PostData & { visitCount: number };

type Props =
  | {
      mode: "latest";
      initialItems: PostItem[];
      initialNextCursor: string | null;
    }
  | {
      mode: "popular";
      initialItems: PostItem[];
      initialOffset: number;
      initialHasMore: boolean;
    };

export function PostsInfiniteList(props: Props) {
  const [items, setItems] = useState<PostItem[]>(props.initialItems);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">(
    () => {
      if (props.mode === "latest") {
        return props.initialNextCursor === null ? "done" : "idle";
      }
      return props.initialHasMore ? "idle" : "done";
    }
  );
  const [nextCursor, setNextCursor] = useState<string | null>(
    props.mode === "latest" ? props.initialNextCursor : null
  );
  const [nextOffset, setNextOffset] = useState<number>(
    props.mode === "popular" ? props.initialOffset : 0
  );

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  async function loadMore() {
    if (statusRef.current === "loading" || statusRef.current === "done") return;
    setStatus("loading");

    try {
      let url: string;
      if (props.mode === "latest") {
        url = `/api/posts/latest?limit=${PAGE_SIZE}${nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : ""}`;
      } else {
        url = `/api/posts/popular?limit=${PAGE_SIZE}&offset=${nextOffset}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        setStatus("error");
        return;
      }

      const data = await res.json();

      setItems((prev) => [...prev, ...data.items]);

      if (props.mode === "latest") {
        setNextCursor(data.nextCursor);
        setStatus(data.nextCursor === null ? "done" : "idle");
      } else {
        setNextOffset(data.nextOffset);
        setStatus(data.hasMore ? "idle" : "done");
      }
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observerRef.current.observe(sentinel);

    return () => {
      observerRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCursor, nextOffset]);

  return (
    <div>
      <div role="feed" className="space-y-3">
        {items.map((item) => (
          <PostCard key={item.path} post={item} viewCount={item.visitCount} />
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden="true" />

      <div aria-live="polite" className="mt-6 flex flex-col items-center gap-4">
        {status === "loading" && (
          <div className="w-full space-y-3">
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </div>
        )}

        {status === "error" && (
          <button
            onClick={loadMore}
            className="px-4 py-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            재시도
          </button>
        )}

        {status === "idle" && (
          <button
            onClick={loadMore}
            className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            더 보기
          </button>
        )}

        {status === "done" && (
          <>
            <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
              더 이상 글이 없습니다.
            </p>
            <BackToTopButton variant="inline" />
          </>
        )}
      </div>
    </div>
  );
}
