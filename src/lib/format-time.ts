// Drizzle createdAt 이 ISO string 으로 직렬화될 가능성 대비 — Date | string 양쪽 수용
export function formatRelativeTime(dateOrIso: Date | string): string {
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return date.toLocaleDateString("ko-KR");
}
