import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { requireAdminPage } from "@/lib/admin/session";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <span className="text-lg font-semibold">FOS Study 관리자</span>
        <AdminSignOutButton />
      </header>
      {children}
    </div>
  );
}
