import { authorizeStudyRequest } from "@/lib/study/auth";
import { publicationRequestSchema } from "@/lib/study/contracts";
import { methodNotAllowed, parseStudyJson, studyErrorResponse, studyJson, StudyHttpError } from "@/lib/study/http";
import { recordPublication } from "@/services/study/recommendations";

export async function POST(request: Request): Promise<Response> {
  try {
    await authorizeStudyRequest(request, "service");
    if (new URL(request.url).search) {
      throw new StudyHttpError(400, "INVALID_REQUEST", "query를 사용할 수 없습니다.");
    }
    return studyJson(await recordPublication(await parseStudyJson(request, publicationRequestSchema)));
  } catch (error) {
    return studyErrorResponse(error);
  }
}

const unsupported = () => methodNotAllowed(["POST"]);
export const GET = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
export const OPTIONS = unsupported;
export const HEAD = unsupported;
