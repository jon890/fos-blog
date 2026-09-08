import { authorizeStudyRequest } from "@/lib/study/auth";
import {
  createRecommendationRunRequestSchema,
  listRecommendationRunsQuerySchema,
} from "@/lib/study/contracts";
import {
  methodNotAllowed,
  parseStudyJson,
  parseStudyQuery,
  studyErrorResponse,
  studyJson,
  StudyHttpError,
} from "@/lib/study/http";
import { listRecommendationRuns, saveRecommendationRun } from "@/services/study/recommendations";

const OWNER_KEY = "owner";

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeStudyRequest(request, "admin-read");
    const query = parseStudyQuery(request.url, listRecommendationRunsQuerySchema);
    return studyJson(await listRecommendationRuns(query));
  } catch (error) {
    return studyErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await authorizeStudyRequest(request, "service");
    if (new URL(request.url).search) {
      throw new StudyHttpError(400, "INVALID_REQUEST", "query를 사용할 수 없습니다.");
    }
    const input = await parseStudyJson(request, createRecommendationRunRequestSchema);
    return studyJson(await saveRecommendationRun(input, OWNER_KEY));
  } catch (error) {
    return studyErrorResponse(error);
  }
}

const unsupported = () => methodNotAllowed(["GET", "POST"]);
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
export const OPTIONS = unsupported;
export const HEAD = unsupported;
