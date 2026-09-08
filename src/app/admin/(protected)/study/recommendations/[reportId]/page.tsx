import { notFound } from "next/navigation";
import { RecommendationReport } from "@/components/study/RecommendationReport";
import { requireAdminPage } from "@/lib/admin/session";
import { STUDY_OWNER_KEY } from "@/lib/study/auth";
import { StudyServiceError } from "@/services/study/errors";
import { getRecommendationRun } from "@/services/study/recommendations";

export default async function RecommendationReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  await requireAdminPage();
  const { reportId } = await params;
  try {
    const report = await getRecommendationRun(reportId, STUDY_OWNER_KEY);
    return <RecommendationReport reportId={reportId} initialReport={report} />;
  } catch (error) {
    if (error instanceof StudyServiceError && error.status === 404) notFound();
    throw error;
  }
}
