import { RecommendationReport } from "@/components/study/RecommendationReport";
import { requireAdminPage } from "@/lib/admin/session";

export default async function RecommendationReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  await requireAdminPage();
  const { reportId } = await params;
  return <RecommendationReport reportId={reportId} />;
}
