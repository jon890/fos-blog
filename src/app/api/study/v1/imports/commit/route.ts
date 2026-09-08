import { authorizeStudyRequest, studyOwnerKey } from "@/lib/study/auth";
import { importCommitRequestSchema } from "@/lib/study/contracts";
import { methodNotAllowed, parseStudyJson, studyErrorResponse, studyJson, StudyHttpError } from "@/lib/study/http";
import { commitImport } from "@/services/study/imports";

export async function POST(request: Request): Promise<Response> {
  try {
    const principal = await authorizeStudyRequest(request, "admin-write");
    if (new URL(request.url).search) {
      throw new StudyHttpError(400, "INVALID_REQUEST", "query를 사용할 수 없습니다.");
    }
    return studyJson(
      await commitImport(
        await parseStudyJson(request, importCommitRequestSchema),
        studyOwnerKey(principal),
      ),
    );
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
