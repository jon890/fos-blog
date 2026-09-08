import { authorizeStudyRequest } from "@/lib/study/auth";
import { putSourceRequestSchema, studyIdentifierSchema } from "@/lib/study/contracts";
import { methodNotAllowed, parseStudyJson, studyErrorResponse, studyJson, StudyHttpError } from "@/lib/study/http";
import { putSource } from "@/services/study/sources";

type Context = { params: Promise<{ sourceKey: string }> };

export async function PUT(request: Request, context: Context): Promise<Response> {
  try {
    await authorizeStudyRequest(request, "service");
    if (new URL(request.url).search) throw new StudyHttpError(400, "INVALID_REQUEST", "query를 사용할 수 없습니다.");
    const parsedKey = studyIdentifierSchema.safeParse((await context.params).sourceKey);
    if (!parsedKey.success) throw new StudyHttpError(400, "INVALID_REQUEST", "sourceKey가 올바르지 않습니다.");
    const input = await parseStudyJson(request, putSourceRequestSchema);
    return studyJson(await putSource(parsedKey.data, input));
  } catch (error) {
    return studyErrorResponse(error);
  }
}

const unsupported = () => methodNotAllowed(["PUT"]);
export const GET = unsupported;
export const POST = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
export const OPTIONS = unsupported;
export const HEAD = unsupported;
