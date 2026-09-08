import type { StudyErrorCode } from "@/lib/study/contracts";

export class StudyServiceError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 503,
    public readonly code: Extract<
      StudyErrorCode,
      "INVALID_REQUEST" | "NOT_FOUND" | "VERSION_CONFLICT" | "UNAVAILABLE"
    >,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "StudyServiceError";
  }
}

export function unavailable(error: unknown): StudyServiceError {
  if (error instanceof StudyServiceError) return error;
  return new StudyServiceError(
    503,
    "UNAVAILABLE",
    "학습자료 저장소를 사용할 수 없습니다.",
    { cause: error },
  );
}
