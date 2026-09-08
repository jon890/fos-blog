import { z } from "zod";
import { authorizeStudyRequest } from "@/lib/study/auth";
import { cursorModeSchema, studyIdentifierSchema } from "@/lib/study/contracts";
import { methodNotAllowed, parseStudyQuery, studyErrorResponse, studyJson, StudyHttpError } from "@/lib/study/http";
import { getSourceCursor } from "@/services/study/sources";

type Context = { params: Promise<{ sourceKey: string }> };
const querySchema = z.strictObject({ mode: cursorModeSchema });

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    await authorizeStudyRequest(request, "service");
    const parsedKey = studyIdentifierSchema.safeParse((await context.params).sourceKey);
    if (!parsedKey.success) throw new StudyHttpError(400, "INVALID_REQUEST", "sourceKey가 올바르지 않습니다.");
    const query = parseStudyQuery(request.url, querySchema);
    return studyJson(await getSourceCursor(parsedKey.data, query.mode));
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
