import type { Material } from "@/lib/study/contracts";
import { MaterialStateEditor, type DesiredMaterialState, type MaterialStateSaveResult } from "./MaterialStateEditor";

type Props = {
  material: Material;
  onSaveState: (materialId: number, input: DesiredMaterialState) => Promise<MaterialStateSaveResult>;
};

function formatPublishedAt(value: string | null): string {
  if (!value) return "발행일 정보 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "발행일 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function MaterialCard({ material, onSaveState }: Props) {
  const hasSafeLink = isHttpsUrl(material.canonicalUrl);
  return (
    <article className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-4 shadow-[var(--shadow-subtle)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-lg font-semibold leading-snug break-keep">{material.title}</h3>
          <p className="text-sm text-[var(--color-fg-secondary)]">{formatPublishedAt(material.publishedAt)} · {material.kind}</p>
        </div>
        {hasSafeLink && <a href={material.canonicalUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg border border-[var(--color-border-default)] px-3 py-1.5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">원문 열기<span className="sr-only">: {material.title}</span></a>}
      </div>
      {material.sources.length > 0 && <p className="mt-3 text-sm text-[var(--color-fg-secondary)]">소스: {material.sources.map((source) => source.sourceName).join(", ")}</p>}
      {material.excerpt && <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-fg-secondary)]">{material.excerpt}</p>}
      {material.tags.length > 0 && <ul aria-label="태그" className="mt-3 flex flex-wrap gap-2">{material.tags.map((tag) => <li key={tag} className="rounded-full border border-[var(--color-border-default)] px-2 py-0.5 text-xs">{tag}</li>)}</ul>}
      <p className="mt-3 text-sm">{material.previouslyRecommended ? "이전에 추천된 자료" : "아직 추천되지 않은 자료"}</p>
      <MaterialStateEditor state={material.state} onSave={(input) => onSaveState(material.id, input)} />
    </article>
  );
}
