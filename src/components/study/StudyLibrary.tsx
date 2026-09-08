"use client";

import { useEffect, useRef, useState } from "react";
import {
  getMaterialResponseSchema,
  listMaterialsResponseSchema,
  listSourcesResponseSchema,
  updateMaterialStateResponseSchema,
  type Material,
} from "@/lib/study/contracts";
import { MaterialList } from "./MaterialList";
import { type DesiredMaterialState, type MaterialStateSaveResult } from "./MaterialStateEditor";
import { StudyFilters, type StudyFiltersValue, type StudyFilterSource } from "./StudyFilters";

type LoadFailure = "unauthenticated" | "failed";

function koreanDateToUtc(value: string, includeFollowingDay: boolean): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + (includeFollowingDay ? 1 : 0)));
  const koreanDate = [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
  return new Date(`${koreanDate}T00:00:00+09:00`).toISOString();
}

function materialUrl(filters: StudyFiltersValue, cursor: string | null): string {
  const params = new URLSearchParams({ limit: "30" });
  if (cursor) params.set("cursor", cursor);
  if (filters.q) params.set("q", filters.q);
  if (filters.sourceKey) params.set("sourceKey", filters.sourceKey);
  if (filters.category) params.set("category", filters.category);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.starred !== undefined) params.set("starred", String(filters.starred));
  if (filters.read !== undefined) params.set("read", String(filters.read));
  if (filters.recommended !== undefined) params.set("recommended", String(filters.recommended));
  if (filters.publishedFrom) params.set("publishedFrom", koreanDateToUtc(filters.publishedFrom, false));
  if (filters.publishedTo) params.set("publishedTo", koreanDateToUtc(filters.publishedTo, true));
  return `/api/study/v1/materials?${params}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error("응답을 읽지 못했습니다.");
  }
}

function sourceItems(value: unknown): StudyFilterSource[] {
  const parsed = listSourcesResponseSchema.safeParse(value);
  if (!parsed.success) throw new Error("소스 응답 형식이 올바르지 않습니다.");
  return parsed.data.sources.map(({ sourceKey, title }) => ({ sourceKey, sourceName: title }));
}

export function StudyLibrary() {
  const [filters, setFilters] = useState<StudyFiltersValue>({});
  const [sources, setSources] = useState<StudyFilterSource[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const [moreFailure, setMoreFailure] = useState(false);
  const requestId = useRef(0);

  async function loadMaterials(nextFilters: StudyFiltersValue, cursor: string | null, append: boolean) {
    const id = ++requestId.current;
    if (append) {
      setIsLoadingMore(true);
      setMoreFailure(false);
    } else {
      setIsLoading(true);
      setLoadFailure(null);
    }
    try {
      const response = await fetch(materialUrl(nextFilters, cursor));
      if (response.status === 401) throw new Error("unauthenticated");
      if (!response.ok) throw new Error("failed");
      const parsed = listMaterialsResponseSchema.safeParse(await readJson(response));
      if (!parsed.success) throw new Error("failed");
      if (id !== requestId.current) return;
      setMaterials((current) => append ? [...current, ...parsed.data.items] : parsed.data.items);
      setNextCursor(parsed.data.nextCursor);
    } catch (error) {
      if (id !== requestId.current) return;
      const failure: LoadFailure = error instanceof Error && error.message === "unauthenticated" ? "unauthenticated" : "failed";
      if (append) setMoreFailure(true);
      else setLoadFailure(failure);
    } finally {
      if (id === requestId.current) {
        if (append) setIsLoadingMore(false);
        else setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadMaterials({}, null, false);
    void (async () => {
      try {
        const response = await fetch("/api/study/v1/sources");
        if (!response.ok) throw new Error("sources");
        setSources(sourceItems(await readJson(response)));
      } catch {
        setSources([]);
      }
    })();
  }, []);

  function applyFilters(nextFilters: StudyFiltersValue) {
    setFilters(nextFilters);
    setMaterials([]);
    setNextCursor(null);
    setMoreFailure(false);
    void loadMaterials(nextFilters, null, false);
  }

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
      setMaterials((current) => current.map((material) => material.id === materialId ? { ...material, state: parsed.data.state } : material));
      return { status: "saved", state: parsed.data.state };
    } catch {
      return recoverLatestState(materialId);
    }
  }

  const hasFilters = Object.values(filters).some((value) => value !== undefined && value !== "");
  const emptyMessage = hasFilters ? "조건에 맞는 자료가 없습니다." : "아직 수집된 학습자료가 없습니다.";

  return (
    <section aria-labelledby="study-library-title" className="space-y-6">
      <div>
        <h1 id="study-library-title" className="text-3xl font-semibold">학습자료</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-secondary)]">수집한 자료를 검색하고 개인 학습 상태를 기록합니다.</p>
      </div>
      <StudyFilters value={filters} sources={sources} onApply={applyFilters} />
      {isLoading && <p role="status" className="rounded-lg border border-dashed border-[var(--color-border-default)] p-6 text-center text-[var(--color-fg-secondary)]">학습자료를 불러오고 있습니다.</p>}
      {loadFailure === "unauthenticated" && <div role="alert" className="rounded-lg border border-[var(--color-warning)] p-4">로그인이 만료되었습니다. <a className="underline" href="/admin/login">다시 로그인</a>한 뒤 자료를 확인해 주세요.</div>}
      {loadFailure === "failed" && <div role="alert" className="rounded-lg border border-[var(--color-warning)] p-4"><p>학습자료를 조회하지 못했습니다.</p><button type="button" className="mt-2 underline" onClick={() => void loadMaterials(filters, null, false)}>다시 시도</button></div>}
      {!isLoading && loadFailure === null && (materials.length > 0 ? <MaterialList materials={materials} onSaveState={saveState} /> : <p role="status" className="rounded-lg border border-dashed border-[var(--color-border-default)] p-6 text-center text-[var(--color-fg-secondary)]">{emptyMessage}</p>)}
      {!isLoading && loadFailure === null && nextCursor && <div className="space-y-2"><button type="button" disabled={isLoadingMore} className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 disabled:opacity-60" onClick={() => void loadMaterials(filters, nextCursor, true)}>{isLoadingMore ? "더 불러오는 중…" : moreFailure ? "더 보기 다시 시도" : "더 보기"}</button>{moreFailure && <p role="status" className="text-sm text-[var(--color-fg-secondary)]">추가 자료를 조회하지 못했습니다. 같은 위치에서 다시 시도할 수 있습니다.</p>}</div>}
    </section>
  );
}
