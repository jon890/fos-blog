import { authorizeStudyRequest } from "@/lib/study/auth";
import { updateMaterialStateRequestSchema } from "@/lib/study/contracts";
import { methodNotAllowed, parseStudyJson, studyErrorResponse, studyJson, StudyHttpError } from "@/lib/study/http";
import { updateMaterialState } from "@/services/study/materials";

type Context = { params: Promise<{ id: string }> };

function materialId(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) throw new StudyHttpError(400, "INVALID_REQUEST", "자료 ID가 올바르지 않습니다.");
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new StudyHttpError(400, "INVALID_REQUEST", "자료 ID가 올바르지 않습니다.");
  return id;
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    await authorizeStudyRequest(request, "admin-write");
    if (new URL(request.url).search) throw new StudyHttpError(400, "INVALID_REQUEST", "query를 사용할 수 없습니다.");
    const input = await parseStudyJson(request, updateMaterialStateRequestSchema);
    return studyJson(await updateMaterialState(materialId((await context.params).id), input));
  } catch (error) {
    return studyErrorResponse(error);
  }
}

const unsupported = () => methodNotAllowed(["PATCH"]);
export const GET = unsupported;
export const POST = unsupported;
export const PUT = unsupported;
export const DELETE = unsupported;
export const OPTIONS = unsupported;
export const HEAD = unsupported;
