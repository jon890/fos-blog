import { authorizeStudyRequest, STUDY_OWNER_KEY } from "@/lib/study/auth";
import { listCandidatesQuerySchema } from "@/lib/study/contracts";
import { methodNotAllowed, parseStudyQuery, studyErrorResponse, studyJson } from "@/lib/study/http";
import { listCandidates } from "@/services/study/recommendations";

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeStudyRequest(request, "service");
    const query = parseStudyQuery(request.url, listCandidatesQuerySchema);
    return studyJson(await listCandidates(query, STUDY_OWNER_KEY));
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
