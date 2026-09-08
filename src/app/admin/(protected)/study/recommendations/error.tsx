"use client";

export default function RecommendationHistoryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="rounded-lg border border-[var(--color-warning)] p-6"><h1 className="text-lg font-semibold">추천 이력 화면을 열지 못했습니다.</h1><p className="mt-2 text-sm text-[var(--color-fg-secondary)]">잠시 후 다시 시도하거나 로그인 상태를 확인해 주세요.</p><div className="mt-4 flex gap-3"><button type="button" className="underline" onClick={reset}>다시 시도</button><a className="underline" href="/admin/login">로그인으로 이동</a></div></section>;
}
