import type { GetRecommendationRunResult, MaterialState } from "@/lib/study/contracts";
import { MaterialStateEditor, type DesiredMaterialState, type MaterialStateSaveResult } from "./MaterialStateEditor";

type Props = {
  report: GetRecommendationRunResult;
  onSaveState: (materialId: number, input: DesiredMaterialState) => Promise<MaterialStateSaveResult>;
};

function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "생성일 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function absentHistoryValue(value: string | null): string {
  return value ?? "기존 이력에 설명 없음";
}

function stateSummary(state: MaterialState): string {
  return `즐겨찾기 ${state.starred ? "예" : "아니오"}, 읽음 ${state.read ? "예" : "아니오"}, 메모 ${state.note || "없음"}`;
}

function careerValueLabel(value: string | null): string {
  if (value === null) return "기존 이력에 설명 없음";
  const labels: Record<string, string> = {
    "current-work": "현재 업무",
    "target-role": "목표 직무",
    "engineering-judgment": "엔지니어링 판단",
    "product-business": "제품·비즈니스",
  };
  return labels[value] ?? value;
}

export function RecommendationDetail({ report, onSaveState }: Props) {
  return (
    <article aria-labelledby="recommendation-report-title" className="space-y-6">
      <header>
        <h1 id="recommendation-report-title" className="text-3xl font-semibold">추천 이력</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-secondary)]">리포트 {report.reportId} · 생성일 {formatGeneratedAt(report.generatedAt)}</p>
      </header>
      {report.topics.length === 0 ? <p role="status" className="rounded-lg border border-dashed border-[var(--color-border-default)] p-6 text-center text-[var(--color-fg-secondary)]">이 추천 실행에는 선택된 주제가 없습니다.</p> : report.topics.map((topic) => (
        <section key={topic.topicKey} aria-labelledby={`topic-${topic.topicKey}`} className="space-y-4 rounded-lg border border-[var(--color-border-subtle)] p-4">
          <div>
            <h2 id={`topic-${topic.topicKey}`} className="text-xl font-semibold">{topic.title}</h2>
            <p className="mt-1 text-sm text-[var(--color-fg-secondary)]">업무 질문: {absentHistoryValue(topic.careerQuestion)}</p>
          </div>
          <ul className="space-y-4">
            {topic.items.map((item) => (
              <li key={`${topic.topicKey}-${item.materialId}`} className="border-t border-[var(--color-border-subtle)] pt-4 first:border-t-0 first:pt-0">
                <h3 className="font-medium">추천 당시 자료: {item.title}</h3>
                <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
                  <dt className="font-medium">추천 당시 요약</dt><dd>{absentHistoryValue(item.summary)}</dd>
                  <dt className="font-medium">추천 당시 이유</dt><dd>{absentHistoryValue(item.reason)}</dd>
                  <dt className="font-medium">추천 당시 분류</dt><dd>{careerValueLabel(item.careerValue)}</dd>
                </dl>
                <a href={item.canonicalUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm underline">추천 당시 원문 열기<span className="sr-only">: {item.title}</span></a>
                <section aria-label={`현재 개인 상태: ${item.title}`} className="mt-4 rounded-md bg-[var(--color-bg-subtle)] p-3">
                  <p className="text-sm font-medium">현재 개인 상태</p>
                  <p className="mt-1 text-sm text-[var(--color-fg-secondary)]">{stateSummary(item.state)}</p>
                  <MaterialStateEditor state={item.state} onSave={(input) => onSaveState(item.materialId, input)} />
                </section>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section aria-labelledby="publication-history-title" className="rounded-lg border border-[var(--color-border-subtle)] p-4">
        <h2 id="publication-history-title" className="text-xl font-semibold">게시 이력</h2>
        {report.publications.length === 0 ? <p className="mt-2 text-sm text-[var(--color-fg-secondary)]">게시 이력이 없습니다.</p> : <ul className="mt-3 space-y-2">{report.publications.map((publication) => <li key={publication.publicationId} className="text-sm">{publication.channel} · {formatGeneratedAt(publication.publishedAt)} · {publication.externalId}{publication.url && <> · <a href={publication.url} target="_blank" rel="noopener noreferrer" className="underline">게시물 열기</a></>}</li>)}</ul>}
      </section>
    </article>
  );
}
