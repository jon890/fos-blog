"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMaterialResponseSchema,
  getRecommendationRunResponseSchema,
  updateMaterialStateResponseSchema,
  type GetRecommendationRunResult,
} from "@/lib/study/contracts";
import { type DesiredMaterialState, type MaterialStateSaveResult } from "./MaterialStateEditor";
import { RecommendationDetail } from "./RecommendationDetail";

type LoadState = "loading" | "ready" | "missing" | "unauthenticated" | "failed";

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error("응답을 읽지 못했습니다.");
  }
}

export function RecommendationReport({ reportId, initialReport }: { reportId: string; initialReport?: GetRecommendationRunResult }) {
  const [report, setReport] = useState<GetRecommendationRunResult | null>(initialReport ?? null);
  const [loadState, setLoadState] = useState<LoadState>(initialReport ? "ready" : "loading");
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoadState("loading");
    try {
      const response = await fetch(`/api/study/v1/recommendation-runs/${encodeURIComponent(reportId)}`);
      if (response.status === 404) {
        if (id === requestId.current) setLoadState("missing");
        return;
      }
      if (response.status === 401) throw new Error("unauthenticated");
      if (!response.ok) throw new Error("failed");
      const parsed = getRecommendationRunResponseSchema.safeParse(await readJson(response));
      if (!parsed.success) throw new Error("failed");
      if (id !== requestId.current) return;
      setReport(parsed.data);
      setLoadState("ready");
    } catch (error) {
      if (id !== requestId.current) return;
      setLoadState(error instanceof Error && error.message === "unauthenticated" ? "unauthenticated" : "failed");
    }
  }, [reportId]);

  useEffect(() => {
    if (!initialReport) void load();
  }, [initialReport, load]);

  async function recoverLatestState(materialId: number): Promise<MaterialStateSaveResult> {
    const response = await fetch(`/api/study/v1/materials/${materialId}`);
    if (response.status === 401) return { status: "unauthenticated" };
    if (!response.ok) throw new Error("최신 상태를 조회하지 못했습니다.");
    const parsed = getMaterialResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) throw new Error("최신 상태 응답 형식이 올바르지 않습니다.");
    return { status: "conflict", latestState: parsed.data.material.state };
  }

  async function saveState(materialId: number, input: DesiredMaterialState): Promise<MaterialStateSaveResult> {
    let response: Response;
    try {
      response = await fetch(`/api/study/v1/materials/${materialId}/state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      return recoverLatestState(materialId);
    }
    if (response.status === 401) return { status: "unauthenticated" };
    if (response.status === 409) return recoverLatestState(materialId);
    if (!response.ok) throw new Error("저장하지 못했습니다.");
    try {
      const parsed = updateMaterialStateResponseSchema.safeParse(await readJson(response));
      if (!parsed.success) throw new Error("저장 응답 형식이 올바르지 않습니다.");
      setReport((current) => current && {
        ...current,
        topics: current.topics.map((topic) => ({
          ...topic,
          items: topic.items.map((item) => item.materialId === materialId ? { ...item, state: parsed.data.state } : item),
        })),
      });
      return { status: "saved", state: parsed.data.state };
    } catch {
      return recoverLatestState(materialId);
    }
  }

  if (loadState === "loading") return <p role="status" className="rounded-lg border border-dashed border-[var(--color-border-default)] p-6 text-center text-[var(--color-fg-secondary)]">추천 이력을 불러오고 있습니다.</p>;
  if (loadState === "missing") return <section aria-labelledby="missing-recommendation-title" className="rounded-lg border border-[var(--color-border-default)] p-6"><h1 id="missing-recommendation-title" className="text-xl font-semibold">추천 이력을 찾을 수 없습니다.</h1><p className="mt-2 text-sm text-[var(--color-fg-secondary)]">주소가 올바른지 확인하거나 추천 이력 목록으로 돌아가세요.</p><a className="mt-4 inline-block underline" href="/admin/study/recommendations">추천 이력 목록</a></section>;
  if (loadState === "unauthenticated") return <div role="alert" className="rounded-lg border border-[var(--color-warning)] p-4">로그인이 만료되었습니다. <a className="underline" href="/admin/login">다시 로그인</a>한 뒤 추천 이력을 확인해 주세요.</div>;
  if (loadState === "failed" || !report) return <div role="alert" className="rounded-lg border border-[var(--color-warning)] p-4"><p>추천 이력을 조회하지 못했습니다.</p><button type="button" className="mt-2 underline" onClick={() => void load()}>다시 시도</button></div>;
  return <RecommendationDetail report={report} onSaveState={saveState} />;
}
