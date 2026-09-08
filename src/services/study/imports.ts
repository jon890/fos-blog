import { getRepositories, type StudyRepository } from "@/infra/db/repositories";
import {
  importCommitResponseSchema,
  importDryRunResponseSchema,
  type ImportCommitRequest,
  type ImportCommitResult,
  type ImportDryRunRequest,
  type ImportDryRunResult,
} from "@/lib/study/contracts";
import { StudyServiceError, unavailable } from "./errors";
import { retryDeadlockedTransaction } from "./deadlock-retry";

type ImportRepository = Pick<StudyRepository, "previewImport" | "commitImport">;

function repositoryOrDefault(repository?: ImportRepository): ImportRepository {
  return repository ?? getRepositories().study;
}

export async function previewImport(
  input: ImportDryRunRequest,
  ownerKey: string,
  repository?: ImportRepository,
): Promise<ImportDryRunResult> {
  try {
    const result = await repositoryOrDefault(repository).previewImport(input, ownerKey);
    if (result.status === "success") return importDryRunResponseSchema.parse(result.response);
    if (result.status === "invalid_request") {
      throw new StudyServiceError(400, "INVALID_REQUEST", result.message);
    }
    throw new StudyServiceError(
      409,
      "IDEMPOTENCY_CONFLICT",
      `같은 reportId에 다른 추천 이력이 저장되어 있습니다: ${result.reportId}`,
    );
  } catch (error) {
    throw unavailable(error);
  }
}

export async function commitImport(
  input: ImportCommitRequest,
  ownerKey: string,
  repository?: ImportRepository,
): Promise<ImportCommitResult> {
  try {
    const studyRepository = repositoryOrDefault(repository);
    const result = await retryDeadlockedTransaction(() =>
      studyRepository.commitImport(input, ownerKey),
    );
    if (result.status === "success") return importCommitResponseSchema.parse(result.response);
    if (result.status === "invalid_request") {
      throw new StudyServiceError(400, "INVALID_REQUEST", result.message);
    }
    if (result.status === "report_conflict") {
      throw new StudyServiceError(
        409,
        "IDEMPOTENCY_CONFLICT",
        `같은 reportId에 다른 추천 이력이 저장되어 있습니다: ${result.reportId}`,
      );
    }
    if (result.status === "import_changed") {
      throw new StudyServiceError(409, "IMPORT_CHANGED", "미리보기 이후 가져오기 본문이나 추천 이력이 변경되었습니다.");
    }
    if (result.status === "version_conflict") {
      throw new StudyServiceError(409, "VERSION_CONFLICT", "추천 이력 버전을 더 늘릴 수 없습니다.");
    }
    throw new StudyServiceError(409, "IDEMPOTENCY_CONFLICT", "같은 importKey에 다른 가져오기 본문이 사용되었습니다.");
  } catch (error) {
    throw unavailable(error);
  }
}
