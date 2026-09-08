import { authorizeStudyRequest, studyOwnerKey } from "@/lib/study/auth";
import { studyIdentifierSchema } from "@/lib/study/contracts";
import { methodNotAllowed, studyErrorResponse, studyJson, StudyHttpError } from "@/lib/study/http";
import { getRecommendationRun } from "@/services/study/recommendations";

type Context = { params: Promise<{ reportId: string }> };

function reportId(value: string): string {
  const parsed = studyIdentifierSchema.safeParse(value);
  if (!parsed.success) {
    throw new StudyHttpError(400, "INVALID_REQUEST", "리포트 ID가 올바르지 않습니다.");
  }
  return parsed.data;
}

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const principal = await authorizeStudyRequest(request, "admin-read");
    if (new URL(request.url).search) {
      throw new StudyHttpError(400, "INVALID_REQUEST", "query를 사용할 수 없습니다.");
    }
    return studyJson(
      await getRecommendationRun(reportId((await context.params).reportId), studyOwnerKey(principal)),
    );
  } catch (error) {
    return studyErrorResponse(error);
  }
}

const unsupported = () => methodNotAllowed(["GET"]);
export const POST = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
export const OPTIONS = unsupported;
export const HEAD = unsupported;
