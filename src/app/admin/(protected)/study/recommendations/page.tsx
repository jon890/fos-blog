import { RecommendationHistory } from "@/components/study/RecommendationHistory";
import { requireAdminPage } from "@/lib/admin/session";

export default async function RecommendationHistoryPage() {
  await requireAdminPage();
  return <RecommendationHistory />;
}
