import { createHash } from "node:crypto";
import {
  getRepositories,
  type StudyCandidateRecord,
  type StudyRepository,
} from "@/infra/db/repositories";
import {
  createRecommendationRunResponseSchema,
  getRecommendationRunResponseSchema,
  listCandidatesResponseSchema,
  listRecommendationRunsResponseSchema,
  publicationResponseSchema,
  type Candidate,
  type CreateRecommendationRunInput,
  type CreateRecommendationRunResult,
  type GetRecommendationRunResult,
  type ListRecommendationRunsResult,
  type MaterialKind,
  type PublicationInput,
  type PublicationResult,
  type SourceCategory,
} from "@/lib/study/contracts";
import { studyRequestHash } from "@/lib/study/request-hash";
import { StudyServiceError, unavailable } from "./errors";

const DEFAULT_LIMIT = 30;

export type ListCandidatesInput = {
  limit?: number;
  cursor?: string;
  sourceKey?: string;
  category?: SourceCategory;
  kind?: MaterialKind;
  publishedFrom?: string;
  publishedTo?: string;
};

export type ListCandidatesResult = {
  candidates: Candidate[];
  recentStudyTopicKeys: string[];
  nextCursor: string | null;
  historyVersion: number;
};

export type ListRecommendationRunsInput = {
  limit?: number;
  cursor?: string;
};

type CandidateCursor = {
  maximumId: number;
  lastId: number;
  filterHash: string;
  historyVersion: number;
};

type RecommendationRunCursor = {
  maximumId: number;
  lastId: number;
};

function repositoryOrDefault(repository?: StudyRepository): StudyRepository {
  return repository ?? getRepositories().study;
}

function candidateFilterHash(input: ListCandidatesInput): string {
  return createHash("sha256")
    .update(JSON.stringify({
      sourceKey: input.sourceKey ?? null,
      category: input.category ?? null,
      kind: input.kind ?? null,
      publishedFrom: input.publishedFrom ?? null,
      publishedTo: input.publishedTo ?? null,
    }))
    .digest("hex");
}

function encodeCursor(value: CandidateCursor | RecommendationRunCursor): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeCandidateCursor(value: string, expectedFilterHash: string): CandidateCursor {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      Array.isArray(decoded) ||
      Object.keys(decoded).sort().join(",") !== ["filterHash", "historyVersion", "lastId", "maximumId"].sort().join(",")
    ) {
      throw new Error("cursor shape");
    }
    const cursor = decoded as Partial<CandidateCursor>;
    if (
      !Number.isSafeInteger(cursor.maximumId) ||
      !Number.isSafeInteger(cursor.lastId) ||
      Number(cursor.maximumId) <= 0 ||
      Number(cursor.lastId) <= 0 ||
      Number(cursor.lastId) > Number(cursor.maximumId) ||
      !Number.isSafeInteger(cursor.historyVersion) ||
      Number(cursor.historyVersion) < 0 ||
      Number(cursor.historyVersion) > 0xffffffff ||
      typeof cursor.filterHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(cursor.filterHash) ||
      cursor.filterHash !== expectedFilterHash
    ) {
      throw new Error("cursor value");
    }
    return cursor as CandidateCursor;
  } catch (error) {
    throw new StudyServiceError(400, "INVALID_REQUEST", "후보 목록 cursor가 유효하지 않습니다.", {
      cause: error,
    });
  }
}

function decodeRecommendationRunCursor(value: string): RecommendationRunCursor {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      Array.isArray(decoded) ||
      Object.keys(decoded).sort().join(",") !== ["lastId", "maximumId"].sort().join(",")
    ) {
      throw new Error("cursor shape");
    }
    const cursor = decoded as Partial<RecommendationRunCursor>;
    if (
      !Number.isSafeInteger(cursor.maximumId) ||
      !Number.isSafeInteger(cursor.lastId) ||
      Number(cursor.maximumId) <= 0 ||
      Number(cursor.lastId) <= 0 ||
      Number(cursor.lastId) > Number(cursor.maximumId)
    ) {
      throw new Error("cursor value");
    }
    return cursor as RecommendationRunCursor;
  } catch (error) {
    throw new StudyServiceError(400, "INVALID_REQUEST", "추천 이력 cursor가 유효하지 않습니다.", {
      cause: error,
    });
  }
}

function toCandidate(record: StudyCandidateRecord): Candidate {
  const candidate = {
    id: record.contentKey,
    contentKey: record.contentKey,
    canonicalUrl: record.canonicalUrl,
    sourceKey: record.sourceKey,
    sourceName: record.sourceName,
    category: record.category as SourceCategory,
    title: record.title,
    url: record.url,
    published: record.published,
    kind: record.kind as MaterialKind,
    previouslyRecommended: record.previouslyRecommended,
  };
  return record.excerpt === null ? candidate : { ...candidate, excerpt: record.excerpt };
}

export async function listCandidates(
  input: ListCandidatesInput,
  ownerKey: string,
  repository?: StudyRepository,
): Promise<ListCandidatesResult> {
  try {
    const studyRepository = repositoryOrDefault(repository);
    const filterHash = candidateFilterHash(input);
    const cursor = input.cursor ? decodeCandidateCursor(input.cursor, filterHash) : null;
    const history = await studyRepository.getRecommendationHistory(ownerKey);
    if (cursor && cursor.historyVersion !== history.historyVersion) {
      throw new StudyServiceError(409, "VERSION_CONFLICT", "후보 조회 중 추천 이력이 변경되었습니다.");
    }
    const maximumId = cursor?.maximumId ?? (await studyRepository.getMaximumMaterialId());
    const page = await studyRepository.listCandidates({
      limit: input.limit ?? DEFAULT_LIMIT,
      maximumId,
      lastId: cursor?.lastId,
      sourceKey: input.sourceKey,
      category: input.category,
      kind: input.kind,
      publishedFrom: input.publishedFrom ? new Date(input.publishedFrom) : undefined,
      publishedTo: input.publishedTo ? new Date(input.publishedTo) : undefined,
    }, ownerKey);
    const last = page.records.at(-1);
    return listCandidatesResponseSchema.parse({
      candidates: page.records.map(toCandidate),
      recentStudyTopicKeys: history.recentTopicKeys,
      nextCursor: page.hasMore && last
        ? encodeCursor({ maximumId, lastId: last.materialId, filterHash, historyVersion: history.historyVersion })
        : null,
      historyVersion: history.historyVersion,
    });
  } catch (error) {
    throw unavailable(error);
  }
}

export async function saveRecommendationRun(
  input: CreateRecommendationRunInput,
  ownerKey: string,
  repository?: StudyRepository,
): Promise<CreateRecommendationRunResult> {
  try {
    const result = await repositoryOrDefault(repository).saveRecommendationRun(
      input,
      ownerKey,
      studyRequestHash(input),
    );
    if (result.status === "success") {
      return createRecommendationRunResponseSchema.parse(result.response);
    }
    if (result.status === "not_found") {
      throw new StudyServiceError(404, "NOT_FOUND", "추천할 자료를 찾을 수 없습니다.");
    }
    if (result.status === "already_recommended") {
      throw new StudyServiceError(409, "ALREADY_RECOMMENDED", "이미 추천한 자료가 포함되어 있습니다.");
    }
    if (result.status === "recent_topic_conflict") {
      throw new StudyServiceError(409, "RECENT_TOPIC_CONFLICT", "직전 추천과 같은 주제가 포함되어 있습니다.");
    }
    if (result.status === "version_conflict") {
      throw new StudyServiceError(409, "VERSION_CONFLICT", "추천 이력 버전을 더 늘릴 수 없습니다.");
    }
    throw new StudyServiceError(409, "IDEMPOTENCY_CONFLICT", "같은 reportId에 다른 추천 본문이 사용되었습니다.");
  } catch (error) {
    throw unavailable(error);
  }
}

export async function listRecommendationRuns(
  input: ListRecommendationRunsInput,
  repository?: StudyRepository,
): Promise<ListRecommendationRunsResult> {
  try {
    const studyRepository = repositoryOrDefault(repository);
    const cursor = input.cursor ? decodeRecommendationRunCursor(input.cursor) : null;
    const maximumId = cursor?.maximumId ?? (await studyRepository.getMaximumRecommendationRunId());
    const page = await studyRepository.listRecommendationRuns({
      limit: input.limit ?? DEFAULT_LIMIT,
      maximumId,
      lastId: cursor?.lastId,
    });
    const last = page.records.at(-1);
    return listRecommendationRunsResponseSchema.parse({
      items: page.records.map((record) => ({
        reportId: record.reportId,
        generatedAt: record.generatedAt.toISOString(),
        topicCount: record.topicCount,
      })),
      nextCursor: page.hasMore && last
        ? encodeCursor({ maximumId, lastId: last.id })
        : null,
    });
  } catch (error) {
    throw unavailable(error);
  }
}

export async function getRecommendationRun(
  reportId: string,
  ownerKey: string,
  repository?: StudyRepository,
): Promise<GetRecommendationRunResult> {
  try {
    const run = await repositoryOrDefault(repository).getRecommendationRun(reportId, ownerKey);
    if (!run) throw new StudyServiceError(404, "NOT_FOUND", "추천 이력을 찾을 수 없습니다.");
    return getRecommendationRunResponseSchema.parse({
      reportId: run.reportId,
      generatedAt: run.generatedAt.toISOString(),
      topics: run.topics.map((topic) => ({
        ...topic,
        items: topic.items.map((item) => ({
          ...item,
          state: {
            ...item.state,
            updatedAt: item.state.updatedAt?.toISOString() ?? null,
          },
        })),
      })),
      publications: run.publications.map((publication) => ({
        ...publication,
        publishedAt: publication.publishedAt.toISOString(),
      })),
    });
  } catch (error) {
    throw unavailable(error);
  }
}

export async function recordPublication(
  input: PublicationInput,
  repository?: StudyRepository,
): Promise<PublicationResult> {
  try {
    const publication = {
      reportId: input.reportId,
      channel: input.channel,
      publishedAt: input.publishedAt,
      externalId: input.externalId,
      url: input.url,
    };
    const result = await repositoryOrDefault(repository).recordPublication(
      input,
      studyRequestHash(input),
      studyRequestHash(publication),
    );
    if (result.status === "success") return publicationResponseSchema.parse(result.response);
    if (result.status === "not_found") {
      throw new StudyServiceError(404, "NOT_FOUND", "게시할 추천 이력을 찾을 수 없습니다.");
    }
    throw new StudyServiceError(409, "IDEMPOTENCY_CONFLICT", "같은 게시 키에 다른 기록이 사용되었습니다.");
  } catch (error) {
    throw unavailable(error);
  }
}
