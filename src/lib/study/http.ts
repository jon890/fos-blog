import { randomUUID } from "node:crypto";
import type { ZodType } from "zod";
import logger from "@/lib/logger";
import { StudyAuthError } from "./auth";
import type { StudyErrorCode } from "./contracts";
import { StudyServiceError } from "@/services/study/errors";

const MAX_BODY_BYTES = 1024 * 1024;
const log = logger.child({ module: "study/http" });

export class StudyHttpError extends Error {
  constructor(
    public readonly status: 400 | 405 | 413 | 429,
    public readonly code: Extract<StudyErrorCode, "INVALID_REQUEST" | "PAYLOAD_TOO_LARGE" | "RATE_LIMITED">,
    message: string,
    public readonly headers?: HeadersInit,
  ) {
    super(message);
    this.name = "StudyHttpError";
  }
}

export function applyStudyPrivateHeaders(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export function studyJson(data: unknown, init: ResponseInit = {}): Response {
  return applyStudyPrivateHeaders(Response.json(data, init));
}

export async function parseStudyJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new StudyHttpError(413, "PAYLOAD_TOO_LARGE", "요청 본문은 1 MiB 이하여야 합니다.");
      }
      chunks.push(value);
    }
  }
  try {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new Error("schema");
    return parsed.data;
  } catch (error) {
    if (error instanceof StudyHttpError) throw error;
    throw new StudyHttpError(400, "INVALID_REQUEST", "요청 본문이 올바르지 않습니다.");
  }
}

export function parseStudyQuery<T>(url: string, schema: ZodType<T>): T {
  const entries: Record<string, string> = Object.create(null) as Record<string, string>;
  const search = new URL(url).searchParams;
  for (const [key, value] of search.entries()) {
    if (Object.hasOwn(entries, key)) {
      throw new StudyHttpError(400, "INVALID_REQUEST", "중복 query를 사용할 수 없습니다.");
    }
    entries[key] = value;
  }
  const parsed = schema.safeParse(entries);
  if (!parsed.success) throw new StudyHttpError(400, "INVALID_REQUEST", "요청 query가 올바르지 않습니다.");
  return parsed.data;
}

export function studyErrorResponse(error: unknown, requestId: string = randomUUID()): Response {
  let status = 503;
  let code: StudyErrorCode = "UNAVAILABLE";
  let message = "학습자료 요청을 처리하지 못했습니다.";
  let headers: HeadersInit | undefined;
  if (error instanceof StudyAuthError || error instanceof StudyServiceError || error instanceof StudyHttpError) {
    status = error.status;
    code = error.code;
    message = error.message;
    if (error instanceof StudyHttpError) headers = error.headers;
  } else {
    log.error({ requestId }, "학습자료 요청 실패");
  }
  return studyJson({ error: { code, message, requestId } }, { status, headers });
}

export function methodNotAllowed(allow: string[], requestId?: string): Response {
  const response = studyErrorResponse(
    new StudyHttpError(405, "INVALID_REQUEST", "지원하지 않는 HTTP 메서드입니다."),
    requestId,
  );
  response.headers.set("Allow", allow.join(", "));
  return response;
}
