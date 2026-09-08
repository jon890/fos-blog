"use client";

import { useEffect, useRef, useState } from "react";
import {
  listRecommendationRunsResponseSchema,
  type ListRecommendationRunsResult,
} from "@/lib/study/contracts";
import { RecommendationList } from "./RecommendationList";

type LoadFailure = "unauthenticated" | "failed";

async function readRuns(url: string): Promise<ListRecommendationRunsResult> {
  const response = await fetch(url);
  if (response.status === 401) throw new Error("unauthenticated");
  if (!response.ok) throw new Error("failed");
  const parsed = listRecommendationRunsResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("failed");
  return parsed.data;
}

export function RecommendationHistory() {
  const [items, setItems] = useState<ListRecommendationRunsResult["items"]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const requestId = useRef(0);

  async function load(cursor: string | null, append: boolean) {
    const id = ++requestId.current;
    if (append) {
      setIsLoadingMore(true);
      setLoadMoreFailed(false);
    } else {
      setIsLoading(true);
      setLoadFailure(null);
    }

    try {
      const params = new URLSearchParams({ limit: "30" });
      if (cursor) params.set("cursor", cursor);
      const result = await readRuns(`/api/study/v1/recommendation-runs?${params}`);
      if (id !== requestId.current) return;
      setItems((current) => append ? [...current, ...result.items] : result.items);
      setNextCursor(result.nextCursor);
    } catch (error) {
      if (id !== requestId.current) return;
      if (append) setLoadMoreFailed(true);
      else setLoadFailure(error instanceof Error && error.message === "unauthenticated" ? "unauthenticated" : "failed");
    } finally {
      if (id === requestId.current) {
        if (append) setIsLoadingMore(false);
        else setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void load(null, false);
  }, []);

  return (
    <section aria-labelledby="recommendation-history-title" className="space-y-6">
      <div>
        <h1 id="recommendation-history-title" className="text-3xl font-semibold">추천 이력</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-secondary)]">저장된 추천 실행과 당시 선택한 주제를 확인합니다.</p>
      </div>
      {isLoading && <p role="status" className="rounded-lg border border-dashed border-[var(--color-border-default)] p-6 text-center text-[var(--color-fg-secondary)]">추천 이력을 불러오고 있습니다.</p>}
      {loadFailure === "unauthenticated" && <div role="alert" className="rounded-lg border border-[var(--color-warning)] p-4">로그인이 만료되었습니다. <a className="underline" href="/admin/login">다시 로그인</a>한 뒤 추천 이력을 확인해 주세요.</div>}
      {loadFailure === "failed" && <div role="alert" className="rounded-lg border border-[var(--color-warning)] p-4"><p>추천 이력을 조회하지 못했습니다.</p><button type="button" className="mt-2 underline" onClick={() => void load(null, false)}>다시 시도</button></div>}
      {!isLoading && loadFailure === null && <RecommendationList items={items} nextCursor={nextCursor} isLoadingMore={isLoadingMore} loadMoreFailed={loadMoreFailed} onLoadMore={() => nextCursor && void load(nextCursor, true)} />}
    </section>
  );
}
