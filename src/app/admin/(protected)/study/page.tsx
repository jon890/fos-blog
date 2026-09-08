import { StudyLibrary } from "@/components/study/StudyLibrary";
import { requireAdminPage } from "@/lib/admin/session";

export default async function StudyPage() {
  await requireAdminPage();
  return <StudyLibrary />;
}
