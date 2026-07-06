export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const normalized = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(normalized.getTime())) return "";
  return `${normalized.getFullYear()}.${String(normalized.getMonth() + 1).padStart(2, "0")}.${String(normalized.getDate()).padStart(2, "0")}`;
}
