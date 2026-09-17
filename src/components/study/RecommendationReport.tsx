"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GetRecommendationRunResult,
  StudyActionResult,
} from "@/lib/study/contracts";
import { saveMaterialStateWithRecovery, type MaterialStateActions } from "./material-state-actions";
import { type DesiredMaterialState, type MaterialStateSaveResult } from "./MaterialStateEditor";
import { RecommendationDetail } from "./RecommendationDetail";

type LoadState = "loading" | "ready" | "missing" | "unauthenticated" | "failed";

type Props = MaterialStateActions & {
  reportId: string;
  initialReport?: GetRecommendationRunResult;
  getReport: (reportId: string) => Promise<StudyActionResult<GetRecommendationRunResult>>;
};

export function RecommendationReport({
  reportId,
  initialReport,
  getReport,
  getMaterial,
  saveMaterialState,
}: Props) {
  const [report, setReport] = useState<GetRecommendationRunResult | null>(initialReport ?? null);
  const [loadState, setLoadState] = useState<LoadState>(initialReport ? "ready" : "loading");
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoadState("loading");
    try {
      const result = await getReport(reportId);
      if (result.status === "error") {
        if (id !== requestId.current) return;
        if (result.code === "not-found") setLoadState("missing");
        else if (result.code === "unauthenticated") setLoadState("unauthenticated");
        else setLoadState("failed");
        return;
      }
      if (id !== requestId.current) return;
      setReport(result.data);
      setLoadState("ready");
    } catch {
      if (id !== requestId.current) return;
      setLoadState("failed");
    }
  }, [getReport, reportId]);

  useEffect(() => {
    if (!initialReport) void load();
  }, [initialReport, load]);

  async function saveState(materialId: number, input: DesiredMaterialState): Promise<MaterialStateSaveResult> {
    return saveMaterialStateWithRecovery(
      { getMaterial, saveMaterialState },
      materialId,
      input,
      (state) => setReport((current) => current && {
        ...current,
        topics: current.topics.map((topic) => ({
          ...topic,
          items: topic.items.map((item) => item.materialId === materialId ? { ...item, state } : item),
        })),
      }),
    );
  }

  if (loadState === "loading") return <p role="status" className="rounded-lg border border-dashed border-[var(--color-border-default)] p-6 text-center text-[var(--color-fg-secondary)]">추천 이력을 불러오고 있습니다.</p>;
  if (loadState === "missing") return <section aria-labelledby="missing-recommendation-title" className="rounded-lg border border-[var(--color-border-default)] p-6"><h1 id="missing-recommendation-title" className="text-xl font-semibold">추천 이력을 찾을 수 없습니다.</h1><p className="mt-2 text-sm text-[var(--color-fg-secondary)]">주소가 올바른지 확인하거나 추천 이력 목록으로 돌아가세요.</p><a className="mt-4 inline-block underline" href="/admin/study/recommendations">추천 이력 목록</a></section>;
  if (loadState === "unauthenticated") return <div role="alert" className="rounded-lg border border-[var(--color-warning)] p-4">로그인이 만료되었습니다. <a className="underline" href="/admin/login">다시 로그인</a>한 뒤 추천 이력을 확인해 주세요.</div>;
  if (loadState === "failed" || !report) return <div role="alert" className="rounded-lg border border-[var(--color-warning)] p-4"><p>추천 이력을 조회하지 못했습니다.</p><button type="button" className="mt-2 underline" onClick={() => void load()}>다시 시도</button></div>;
  return <RecommendationDetail report={report} onSaveState={saveState} />;
}
