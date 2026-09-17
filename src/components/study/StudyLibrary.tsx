"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Material,
  StudyActionResult,
  StudyMaterialQuery,
  StudySourceSummary,
} from "@/lib/study/contracts";
import { MaterialList } from "./MaterialList";
import { saveMaterialStateWithRecovery, type MaterialStateActions } from "./material-state-actions";
import { type DesiredMaterialState, type MaterialStateSaveResult } from "./MaterialStateEditor";
import { StudyFilters, type StudyFiltersValue, type StudyFilterSource } from "./StudyFilters";

type LoadFailure = "unauthenticated" | "failed";

type StudyMaterialPage = { items: Material[]; nextCursor: string | null };

type Props = MaterialStateActions & {
  listMaterials: (query: StudyMaterialQuery) => Promise<StudyActionResult<StudyMaterialPage>>;
  listSources: () => Promise<StudyActionResult<StudySourceSummary[]>>;
};

const booleanFilters = ["starred", "read", "recommended"] as const;

function filtersFromSearch(search: string): StudyFiltersValue {
  const params = new URLSearchParams(search);
  const filters: StudyFiltersValue = {};
  for (const key of ["q", "sourceKey", "publishedFrom", "publishedTo"] as const) {
    const value = params.get(key);
    if (value) filters[key] = value;
  }
  const category = params.get("category");
  if (["techBlog", "geek", "ai", "video"].includes(category ?? "")) {
    filters.category = category as StudyFiltersValue["category"];
  }
  const kind = params.get("kind");
  if (["feed-article", "feed-video", "page-link", "page-video"].includes(kind ?? "")) {
    filters.kind = kind as StudyFiltersValue["kind"];
  }
  for (const key of booleanFilters) {
    const value = params.get(key);
    if (value === "true" || value === "false") filters[key] = value === "true";
  }
  return filters;
}

function filterSearch(filters: StudyFiltersValue): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function koreanDateToUtc(value: string, includeFollowingDay: boolean): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + (includeFollowingDay ? 1 : 0)));
  const koreanDate = [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
  return new Date(`${koreanDate}T00:00:00+09:00`).toISOString();
}

function materialQuery(filters: StudyFiltersValue, cursor: string | null): StudyMaterialQuery {
  const query: StudyMaterialQuery = { limit: 30 };
  if (cursor) query.cursor = cursor;
  if (filters.q) query.q = filters.q;
  if (filters.sourceKey) query.sourceKey = filters.sourceKey;
  if (filters.category) query.category = filters.category;
  if (filters.kind) query.kind = filters.kind;
  if (filters.starred !== undefined) query.starred = filters.starred;
  if (filters.read !== undefined) query.read = filters.read;
  if (filters.recommended !== undefined) query.recommended = filters.recommended;
  if (filters.publishedFrom) query.publishedFrom = koreanDateToUtc(filters.publishedFrom, false);
  if (filters.publishedTo) query.publishedTo = koreanDateToUtc(filters.publishedTo, true);
  return query;
}

export function StudyLibrary({ listMaterials, listSources, getMaterial, saveMaterialState }: Props) {
  const [filters, setFilters] = useState<StudyFiltersValue>(() =>
    typeof window === "undefined" ? {} : filtersFromSearch(window.location.search));
  const [sources, setSources] = useState<StudyFilterSource[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const [moreFailure, setMoreFailure] = useState(false);
  const requestId = useRef(0);

  const loadMaterials = useCallback(async (nextFilters: StudyFiltersValue, cursor: string | null, append: boolean) => {
    const id = ++requestId.current;
    if (append) {
      setIsLoadingMore(true);
      setMoreFailure(false);
    } else {
      setIsLoading(true);
      setLoadFailure(null);
    }
    try {
      const result = await listMaterials(materialQuery(nextFilters, cursor));
      if (result.status === "error") throw new Error(result.code);
      if (id !== requestId.current) return;
      setMaterials((current) => append ? [...current, ...result.data.items] : result.data.items);
      setNextCursor(result.data.nextCursor);
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
  }, [listMaterials]);

  useEffect(() => {
    void loadMaterials(filters, null, false);
  }, [filters, loadMaterials]);

  useEffect(() => {
    void (async () => {
      try {
        const result = await listSources();
        setSources(result.status === "ok" ? result.data : []);
      } catch {
        setSources([]);
      }
    })();
  }, [listSources]);

  useEffect(() => {
    function restoreFilters() {
      const restored = filtersFromSearch(window.location.search);
      setFilters(restored);
      setMaterials([]);
      setNextCursor(null);
      setMoreFailure(false);
    }
    window.addEventListener("popstate", restoreFilters);
    return () => window.removeEventListener("popstate", restoreFilters);
  }, []);

  function applyFilters(nextFilters: StudyFiltersValue) {
    window.history.pushState(null, "", `${window.location.pathname}${filterSearch(nextFilters)}`);
    setFilters(nextFilters);
    setMaterials([]);
    setNextCursor(null);
    setMoreFailure(false);
  }

  async function saveState(materialId: number, input: DesiredMaterialState): Promise<MaterialStateSaveResult> {
    return saveMaterialStateWithRecovery(
      { getMaterial, saveMaterialState },
      materialId,
      input,
      (state) => setMaterials((current) => current.map((material) => material.id === materialId ? { ...material, state } : material)),
    );
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
