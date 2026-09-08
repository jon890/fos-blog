"use client";

import { useEffect, useState } from "react";
import type { MaterialKind, SourceCategory } from "@/lib/study/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type StudyFiltersValue = {
  q?: string;
  sourceKey?: string;
  category?: SourceCategory;
  kind?: MaterialKind;
  starred?: boolean;
  read?: boolean;
  recommended?: boolean;
  publishedFrom?: string;
  publishedTo?: string;
};

export type StudyFilterSource = { sourceKey: string; sourceName: string };

type Props = {
  value: StudyFiltersValue;
  sources: StudyFilterSource[];
  onApply: (value: StudyFiltersValue) => void;
};

const emptyFilters: StudyFiltersValue = {};

function booleanValue(value: boolean | undefined): string {
  return value === undefined ? "" : String(value);
}

function parseBoolean(value: string): boolean | undefined {
  return value === "" ? undefined : value === "true";
}

function activeFilterLabels(value: StudyFiltersValue, sources: StudyFilterSource[]): string[] {
  const source = sources.find((item) => item.sourceKey === value.sourceKey);
  return [
    value.q && `검색: ${value.q}`,
    value.sourceKey && `소스: ${source?.sourceName ?? value.sourceKey}`,
    value.category && `분류: ${value.category}`,
    value.kind && `종류: ${value.kind}`,
    value.starred !== undefined && `즐겨찾기: ${value.starred ? "예" : "아니오"}`,
    value.read !== undefined && `읽음: ${value.read ? "예" : "아니오"}`,
    value.recommended !== undefined && `추천: ${value.recommended ? "예" : "아니오"}`,
    value.publishedFrom && `발행 시작: ${value.publishedFrom}`,
    value.publishedTo && `발행 끝: ${value.publishedTo}`,
  ].filter((label): label is string => Boolean(label));
}

export function StudyFilters({ value, sources, onApply }: Props) {
  const [draft, setDraft] = useState<StudyFiltersValue>(value);
  const [isOpen, setIsOpen] = useState(false);
  const activeFilters = activeFilterLabels(value, sources);

  useEffect(() => setDraft(value), [value]);

  function setValue<K extends keyof StudyFiltersValue>(key: K, nextValue: StudyFiltersValue[K]) {
    setDraft((current) => ({ ...current, [key]: nextValue === "" ? undefined : nextValue }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply(draft);
  }

  function reset() {
    setDraft(emptyFilters);
    onApply(emptyFilters);
  }

  return (
    <section aria-label="자료 필터" className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">검색과 필터</h2>
          <p className="text-sm text-[var(--color-fg-secondary)]">검색어와 조건을 적용해 자료를 찾습니다.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="md:hidden" aria-expanded={isOpen} aria-controls="study-filter-fields" onClick={() => setIsOpen((current) => !current)}>
          {isOpen ? "필터 접기" : "필터 열기"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="현재 필터">
        <span className="text-sm font-medium">현재 필터</span>
        {activeFilters.length === 0 ? <span className="text-sm text-[var(--color-fg-secondary)]">없음</span> : activeFilters.map((label) => (
          <span key={label} className="rounded-full border border-[var(--color-border-default)] px-2 py-0.5 text-xs text-[var(--color-fg-secondary)]">{label}</span>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={reset}>초기화</Button>
      </div>

      <form id="study-filter-fields" className={`${isOpen ? "block" : "hidden"} mt-4 border-t border-[var(--color-border-subtle)] pt-4 md:block`} onSubmit={submit}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5"><Label htmlFor="study-query">검색</Label><Input id="study-query" value={draft.q ?? ""} maxLength={200} onChange={(event) => setValue("q", event.target.value)} placeholder="제목 또는 발췌" /></div>
          <div className="space-y-1.5"><Label htmlFor="study-source">소스</Label><select id="study-source" className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={draft.sourceKey ?? ""} onChange={(event) => setValue("sourceKey", event.target.value)}><option value="">모든 소스</option>{sources.map((source) => <option key={source.sourceKey} value={source.sourceKey}>{source.sourceName}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="study-category">분류</Label><select id="study-category" className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={draft.category ?? ""} onChange={(event) => setValue("category", (event.target.value || undefined) as SourceCategory | undefined)}><option value="">모든 분류</option><option value="techBlog">기술 블로그</option><option value="geek">Geek</option><option value="ai">AI</option><option value="video">동영상</option></select></div>
          <div className="space-y-1.5"><Label htmlFor="study-kind">종류</Label><select id="study-kind" className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={draft.kind ?? ""} onChange={(event) => setValue("kind", (event.target.value || undefined) as MaterialKind | undefined)}><option value="">모든 종류</option><option value="feed-article">피드 글</option><option value="feed-video">피드 동영상</option><option value="page-link">페이지 링크</option><option value="page-video">페이지 동영상</option></select></div>
          <div className="space-y-1.5"><Label htmlFor="study-starred">즐겨찾기</Label><select id="study-starred" className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={booleanValue(draft.starred)} onChange={(event) => setValue("starred", parseBoolean(event.target.value))}><option value="">모두</option><option value="true">예</option><option value="false">아니오</option></select></div>
          <div className="space-y-1.5"><Label htmlFor="study-read">읽음</Label><select id="study-read" className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={booleanValue(draft.read)} onChange={(event) => setValue("read", parseBoolean(event.target.value))}><option value="">모두</option><option value="true">읽음</option><option value="false">읽지 않음</option></select></div>
          <div className="space-y-1.5"><Label htmlFor="study-recommended">추천</Label><select id="study-recommended" className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={booleanValue(draft.recommended)} onChange={(event) => setValue("recommended", parseBoolean(event.target.value))}><option value="">모두</option><option value="true">추천됨</option><option value="false">미추천</option></select></div>
          <div className="grid grid-cols-2 gap-2"><div className="space-y-1.5"><Label htmlFor="study-from">발행 시작</Label><Input id="study-from" type="date" value={draft.publishedFrom ?? ""} onChange={(event) => setValue("publishedFrom", event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="study-to">발행 끝</Label><Input id="study-to" type="date" value={draft.publishedTo ?? ""} onChange={(event) => setValue("publishedTo", event.target.value)} /></div></div>
        </div>
        <div className="mt-4"><Button type="submit">필터 적용</Button></div>
      </form>
    </section>
  );
}
