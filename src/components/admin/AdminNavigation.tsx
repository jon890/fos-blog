import Link from "next/link";

const studyMenus = [
  { path: "/admin/study", label: "공부" },
  { path: "/admin/study/recommendations", label: "추천 이력" },
  { path: "/admin/study/imports", label: "이력 가져오기" },
] as const;

export function AdminNavigation() {
  return (
    <nav aria-label="공부 메뉴">
      <ul className="grid gap-3 sm:grid-cols-3">
        {studyMenus.map(({ path, label }, index) => (
          <li key={path}>
            {index === 0 ? <Link href={path} aria-label={`${label} 열기`} className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--color-border-default)] p-4 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><span>{label}</span><span className="text-sm text-[var(--color-fg-secondary)]">열기</span></Link> : <button type="button" disabled aria-label={`${label} 준비 중`} className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--color-border-default)] p-4 text-left disabled:cursor-not-allowed"><span>{label}</span><span className="text-sm text-[var(--color-fg-secondary)]">준비 중</span></button>}
          </li>
        ))}
      </ul>
    </nav>
  );
}
