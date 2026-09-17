import { notFound } from "next/navigation";
import { RecommendationReport } from "@/components/study/RecommendationReport";
import { requireAdminPage } from "@/lib/admin/session";
import {
  getStudyMaterialAction,
  getStudyRecommendationRunAction,
  updateStudyMaterialStateAction,
} from "../../actions";

export default async function RecommendationReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  await requireAdminPage();
  const { reportId } = await params;
  const result = await getStudyRecommendationRunAction(reportId);
  if (result.status === "error" && result.code === "not-found") notFound();
  return (
    <RecommendationReport
      reportId={reportId}
      initialReport={result.status === "ok" ? result.data : undefined}
      getReport={getStudyRecommendationRunAction}
      getMaterial={getStudyMaterialAction}
      saveMaterialState={updateStudyMaterialStateAction}
    />
  );
}
