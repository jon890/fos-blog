import { createHash } from "node:crypto";
import {
  getRepositories,
  type StudyMaterialRecord,
  type StudyRepository,
} from "@/infra/db/repositories";
import type {
  Material,
  MaterialKind,
  SourceCategory,
  UpdateMaterialStateRequest,
} from "@/lib/study/contracts";
import { StudyServiceError, unavailable } from "./errors";

const DEFAULT_LIMIT = 30;

export type ListMaterialsInput = {
  limit?: number;
  cursor?: string;
  q?: string;
  sourceKey?: string;
  category?: SourceCategory;
  kind?: MaterialKind;
  starred?: boolean;
  read?: boolean;
  recommended?: boolean;
  publishedFrom?: string;
  publishedTo?: string;
};

export type ListMaterialsResult = { items: Material[]; nextCursor: string | null };
export type GetMaterialResult = { material: Material };
export type UpdateMaterialStateResult = { state: Material["state"] };

type MaterialCursor = {
  maximumId: number;
  lastId: number;
  filterHash: string;
};

function repositoryOrDefault(repository?: StudyRepository): StudyRepository {
  return repository ?? getRepositories().study;
}

function filterHash(input: ListMaterialsInput): string {
  const value = {
    q: input.q ?? null,
    sourceKey: input.sourceKey ?? null,
    category: input.category ?? null,
    kind: input.kind ?? null,
    starred: input.starred ?? null,
    read: input.read ?? null,
    recommended: input.recommended ?? null,
    publishedFrom: input.publishedFrom ?? null,
    publishedTo: input.publishedTo ?? null,
  };
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function encodeCursor(cursor: MaterialCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string, expectedFilterHash: string): MaterialCursor {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      Array.isArray(decoded) ||
      Object.keys(decoded).sort().join(",") !== "filterHash,lastId,maximumId".split(",").sort().join(",")
    ) {
      throw new Error("cursor shape");
    }
    const cursor = decoded as Partial<MaterialCursor>;
    if (
      !Number.isSafeInteger(cursor.maximumId) ||
      !Number.isSafeInteger(cursor.lastId) ||
      Number(cursor.maximumId) <= 0 ||
      Number(cursor.lastId) <= 0 ||
      Number(cursor.lastId) > Number(cursor.maximumId) ||
      typeof cursor.filterHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(cursor.filterHash) ||
      cursor.filterHash !== expectedFilterHash
    ) {
      throw new Error("cursor value");
    }
    return cursor as MaterialCursor;
  } catch (error) {
    throw new StudyServiceError(400, "INVALID_REQUEST", "자료 목록 cursor가 유효하지 않습니다.", {
      cause: error,
    });
  }
}

function toMaterial(record: StudyMaterialRecord): Material {
  return {
    id: record.id,
    contentKey: record.contentKey,
    canonicalUrl: record.canonicalUrl,
    title: record.title,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    excerpt: record.excerpt,
    tags: record.tags,
    kind: record.kind as Material["kind"],
    sources: record.sources.map((source) => ({
      sourceKey: source.sourceKey,
      sourceName: source.sourceName,
      category: source.category as Material["sources"][number]["category"],
    })),
    state: {
      starred: record.state.starred,
      read: record.state.read,
      note: record.state.note,
      version: record.state.version,
      updatedAt: record.state.updatedAt?.toISOString() ?? null,
    },
    previouslyRecommended: record.previouslyRecommended,
  };
}

export async function listMaterials(
  input: ListMaterialsInput,
  ownerKey: string,
  repository?: StudyRepository,
): Promise<ListMaterialsResult> {
  try {
    const studyRepository = repositoryOrDefault(repository);
    const currentFilterHash = filterHash(input);
    const cursor = input.cursor ? decodeCursor(input.cursor, currentFilterHash) : null;
    const maximumId = cursor?.maximumId ?? (await studyRepository.getMaximumMaterialId());
    const page = await studyRepository.listMaterials({
      limit: input.limit ?? DEFAULT_LIMIT,
      maximumId,
      lastId: cursor?.lastId,
      q: input.q,
      sourceKey: input.sourceKey,
      category: input.category,
      kind: input.kind,
      starred: input.starred,
      read: input.read,
      recommended: input.recommended,
      publishedFrom: input.publishedFrom ? new Date(input.publishedFrom) : undefined,
      publishedTo: input.publishedTo ? new Date(input.publishedTo) : undefined,
    }, ownerKey);
    const last = page.records.at(-1);
    return {
      items: page.records.map(toMaterial),
      nextCursor:
        page.hasMore && last
          ? encodeCursor({ maximumId, lastId: last.id, filterHash: currentFilterHash })
          : null,
    };
  } catch (error) {
    throw unavailable(error);
  }
}

export async function getMaterial(
  id: number,
  ownerKey: string,
  repository?: StudyRepository,
): Promise<GetMaterialResult> {
  try {
    const material = await repositoryOrDefault(repository).getMaterial(id, ownerKey);
    if (!material) throw new StudyServiceError(404, "NOT_FOUND", "자료를 찾을 수 없습니다.");
    return { material: toMaterial(material) };
  } catch (error) {
    throw unavailable(error);
  }
}

export async function updateMaterialState(
  id: number,
  input: UpdateMaterialStateRequest,
  ownerKey: string,
  repository?: StudyRepository,
): Promise<UpdateMaterialStateResult> {
  try {
    const result = await repositoryOrDefault(repository).updateMaterialState(id, input, ownerKey);
    if (result.status === "not_found") {
      throw new StudyServiceError(404, "NOT_FOUND", "자료를 찾을 수 없습니다.");
    }
    if (result.status === "version_conflict") {
      throw new StudyServiceError(409, "VERSION_CONFLICT", "개인 상태 버전이 변경되었습니다.");
    }
    return {
      state: {
        starred: result.state.starred,
        read: result.state.read,
        note: result.state.note,
        version: result.state.version,
        updatedAt: result.state.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    throw unavailable(error);
  }
}
