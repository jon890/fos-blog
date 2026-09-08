import Link from "next/link";
import type { RecommendationRunSummary } from "@/lib/study/contracts";

type Props = {
  items: RecommendationRunSummary[];
  nextCursor: string | null;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  loadMoreFailed?: boolean;
};

function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "생성일 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function RecommendationList({
  items,
  nextCursor,
  onLoadMore,
  isLoadingMore = false,
  loadMoreFailed = false,
}: Props) {
  if (items.length === 0) {
    return <p role="status" className="rounded-lg border border-dashed border-[var(--color-border-default)] p-6 text-center text-[var(--color-fg-secondary)]">아직 추천 실행 이력이 없습니다.</p>;
  }

  return (
    <section aria-label="추천 이력" className="space-y-4">
      <ol className="space-y-3">
        {items.map((item) => (
          <li key={item.reportId}>
            <Link href={`/admin/study/recommendations/${encodeURIComponent(item.reportId)}`} className="block rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <h2 className="font-semibold">{item.reportId}</h2>
              <p className="mt-1 text-sm text-[var(--color-fg-secondary)]">생성일 {formatGeneratedAt(item.generatedAt)} · 주제 {item.topicCount}개</p>
            </Link>
          </li>
        ))}
      </ol>
      {nextCursor && onLoadMore && <div className="space-y-2"><button type="button" disabled={isLoadingMore} className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 disabled:opacity-60" onClick={onLoadMore}>{isLoadingMore ? "더 불러오는 중…" : loadMoreFailed ? "더 보기 다시 시도" : "더 보기"}</button>{loadMoreFailed && <p role="status" className="text-sm text-[var(--color-fg-secondary)]">추가 추천 이력을 조회하지 못했습니다. 다시 시도해 주세요.</p>}</div>}
    </section>
  );
}
