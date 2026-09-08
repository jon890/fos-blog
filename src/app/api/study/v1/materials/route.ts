import { authorizeStudyRequest } from "@/lib/study/auth";
import { listMaterialsQuerySchema } from "@/lib/study/contracts";
import { methodNotAllowed, parseStudyQuery, studyErrorResponse, studyJson } from "@/lib/study/http";
import { listMaterials } from "@/services/study/materials";

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeStudyRequest(request, "admin-read");
    const query = parseStudyQuery(request.url, listMaterialsQuerySchema);
    return studyJson(await listMaterials(query));
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
