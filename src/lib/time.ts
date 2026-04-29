const DAY = 24 * 60 * 60 * 1000;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function formatRelativeKo(date: Date | string | null | undefined): string {
  const d = toDate(date);
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 7 * DAY) return `${Math.max(1, Math.floor(diff / DAY))}일 전`;
  if (diff < 30 * DAY) return `${Math.floor(diff / (7 * DAY))}주 전`;
  if (diff < 365 * DAY) return `${Math.floor(diff / (30 * DAY))}개월 전`;
  return `${Math.floor(diff / (365 * DAY))}년 전`;
}

export function formatYYYYMMDD(date: Date | string | null | undefined): string {
  const d = toDate(date);
  if (!d) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}
