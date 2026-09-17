import { RecommendationHistory } from "@/components/study/RecommendationHistory";
import { requireAdminPage } from "@/lib/admin/session";
import { listStudyRecommendationRunsAction } from "../actions";

export default async function RecommendationHistoryPage() {
  await requireAdminPage();
  return <RecommendationHistory listRuns={listStudyRecommendationRunsAction} />;
}
