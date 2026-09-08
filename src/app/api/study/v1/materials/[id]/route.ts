import { authorizeStudyRequest } from "@/lib/study/auth";
import { methodNotAllowed, studyErrorResponse, studyJson, StudyHttpError } from "@/lib/study/http";
import { getMaterial } from "@/services/study/materials";

type Context = { params: Promise<{ id: string }> };

function materialId(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) throw new StudyHttpError(400, "INVALID_REQUEST", "자료 ID가 올바르지 않습니다.");
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new StudyHttpError(400, "INVALID_REQUEST", "자료 ID가 올바르지 않습니다.");
  return id;
}

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    await authorizeStudyRequest(request, "admin-read");
    if (new URL(request.url).search) throw new StudyHttpError(400, "INVALID_REQUEST", "query를 사용할 수 없습니다.");
    return studyJson(await getMaterial(materialId((await context.params).id)));
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
