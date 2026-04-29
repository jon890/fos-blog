const DAY = 24 * 60 * 60 * 1000;

export function formatRelativeKo(date: Date | null): string {
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  if (diff < 7 * DAY) return `${Math.max(1, Math.floor(diff / DAY))}일 전`;
  if (diff < 30 * DAY) return `${Math.floor(diff / (7 * DAY))}주 전`;
  if (diff < 365 * DAY) return `${Math.floor(diff / (30 * DAY))}개월 전`;
  return `${Math.floor(diff / (365 * DAY))}년 전`;
}

export function formatYYYYMMDD(date: Date | null): string {
  if (!date) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}
