import { authorizeStudyRequest } from "@/lib/study/auth";
import { methodNotAllowed, studyErrorResponse, studyJson, StudyHttpError } from "@/lib/study/http";
import { listSources } from "@/services/study/sources";

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeStudyRequest(request, "service-or-admin");
    if (new URL(request.url).search) throw new StudyHttpError(400, "INVALID_REQUEST", "query를 사용할 수 없습니다.");
    return studyJson(await listSources());
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
