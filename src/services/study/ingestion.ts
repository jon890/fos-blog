import { getRepositories, type StudyRepository } from "@/infra/db/repositories";
import {
  ingestionResponseSchema,
  type IngestBatchInput,
  type IngestBatchResult,
} from "@/lib/study/contracts";
import { studyRequestHash } from "@/lib/study/request-hash";
import { retryDeadlockedTransaction } from "./deadlock-retry";
import { StudyServiceError, unavailable } from "./errors";

type IngestionRepository = Pick<StudyRepository, "getIngestionReceipt" | "ingestBatch">;

function repositoryOrDefault(repository?: IngestionRepository): IngestionRepository {
  return repository ?? getRepositories().study;
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

  try {
    return await retryDeadlockedTransaction(async () => {
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
    });
  } catch (error) {
    if (error instanceof StudyServiceError) throw error;
    throw unavailable(error);
  }
}
