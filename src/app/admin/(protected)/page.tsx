import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { requireAdminPage } from "@/lib/admin/session";

export default async function AdminHomePage() {
  const { user } = await requireAdminPage();
  return (
    <div className="space-y-8">
      <section aria-labelledby="admin-home-title" className="space-y-4">
        <h1 id="admin-home-title" className="text-3xl font-semibold">관리자 홈</h1>
        <dl className="rounded-lg border border-[var(--color-border-default)] p-4">
          <dt className="text-sm text-[var(--color-fg-secondary)]">로그인한 본인 계정</dt>
          <dd className="mt-2 break-words font-medium">{user.name}</dd>
        </dl>
      </section>
      <section aria-labelledby="admin-study-title" className="space-y-4">
        <h2 id="admin-study-title" className="text-xl font-semibold">공부</h2>
        <p className="text-sm text-[var(--color-fg-secondary)]">공부 자료를 관리하고 추천 이력과 과거 이력을 확인할 수 있습니다.</p>
        <AdminNavigation />
      </section>
    </div>
  );
}
