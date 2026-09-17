import { ImportPanel } from "@/components/study/ImportPanel";
import { requireAdminPage } from "@/lib/admin/session";
import { commitStudyImportAction, dryRunStudyImportAction } from "../actions";

export default async function ImportHistoryPage() {
  await requireAdminPage();
  return <ImportPanel onDryRun={dryRunStudyImportAction} onCommit={commitStudyImportAction} />;
}
