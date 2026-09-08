import { getRepositories, type StudyRepository } from "@/infra/db/repositories";
import {
  ingestionResponseSchema,
  type IngestBatchInput,
  type IngestBatchResult,
} from "@/lib/study/contracts";
import { studyRequestHash } from "@/lib/study/request-hash";
import { StudyServiceError, unavailable } from "./errors";

const MAX_DEADLOCK_RETRIES = 2;

type IngestionRepository = Pick<StudyRepository, "getIngestionReceipt" | "ingestBatch">;

function repositoryOrDefault(repository?: IngestionRepository): IngestionRepository {
  return repository ?? getRepositories().study;
}

function isDeadlockError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current !== null; depth += 1) {
    if (typeof current !== "object") return false;
    const candidate = current as {
      code?: unknown;
      errno?: unknown;
      sqlState?: unknown;
      cause?: unknown;
    };
    if (
      candidate.code === "ER_LOCK_DEADLOCK" ||
      candidate.errno === 1213 ||
      candidate.sqlState === "40001"
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

function receiptResponse(
  requestHash: string,
  receipt: { requestHash: string; response: Record<string, unknown> },
): IngestBatchResult {
  if (receipt.requestHash !== requestHash) {
    throw new StudyServiceError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "같은 멱등 키에 다른 수집 본문이 사용되었습니다.",
    );
  }
  return ingestionResponseSchema.parse(receipt.response);
}

export async function ingestBatch(
  input: IngestBatchInput,
  repository?: IngestionRepository,
): Promise<IngestBatchResult> {
  const studyRepository = repositoryOrDefault(repository);
  const requestHash = studyRequestHash(input);

  for (let attempt = 0; attempt <= MAX_DEADLOCK_RETRIES; attempt += 1) {
    try {
      const receipt = await studyRepository.getIngestionReceipt(input.idempotencyKey);
      if (receipt) return receiptResponse(requestHash, receipt);

      const result = await studyRepository.ingestBatch(input, requestHash);
      if (result.status === "success") return ingestionResponseSchema.parse(result.response);
      if (result.status === "idempotency_conflict") {
        throw new StudyServiceError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "같은 멱등 키에 다른 수집 본문이 사용되었습니다.",
        );
      }
      if (result.status === "not_found") {
        throw new StudyServiceError(404, "NOT_FOUND", "수집 소스를 찾을 수 없습니다.");
      }
      if (result.status === "source_disabled") {
        throw new StudyServiceError(400, "INVALID_REQUEST", "비활성 소스에는 자료를 저장할 수 없습니다.");
      }
      throw new StudyServiceError(409, "VERSION_CONFLICT", "수집 cursor 버전이 변경되었습니다.");
    } catch (error) {
      if (error instanceof StudyServiceError) throw error;
      if (isDeadlockError(error) && attempt < MAX_DEADLOCK_RETRIES) continue;
      throw unavailable(error);
    }
  }

  throw new StudyServiceError(503, "UNAVAILABLE", "학습자료 저장소를 사용할 수 없습니다.");
}
