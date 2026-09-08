import { ImportPanel } from "@/components/study/ImportPanel";
import { requireAdminPage } from "@/lib/admin/session";

export default async function ImportHistoryPage() {
  await requireAdminPage();
  return <ImportPanel />;
}
