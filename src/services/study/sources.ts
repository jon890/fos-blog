import { getRepositories, type StudyRepository } from "@/infra/db/repositories";
import type {
  CursorMode,
  PutSourceRequest,
  Source,
} from "@/lib/study/contracts";
import { StudyServiceError, unavailable } from "./errors";

export type PutSourceResult = { source: Source; version: number };
export type ListSourcesResult = { sources: Source[] };
export type GetSourceCursorResult = {
  sourceKey: string;
  mode: CursorMode;
  cursor: Record<string, unknown> | null;
  version: number;
};

function repositoryOrDefault(repository?: StudyRepository): StudyRepository {
  return repository ?? getRepositories().study;
}

function toSource(source: Awaited<ReturnType<StudyRepository["listSources"]>>[number]): Source {
  return {
    sourceKey: source.sourceKey,
    title: source.title,
    category: source.category as Source["category"],
    url: source.url,
    feedUrl: source.feedUrl,
    adapter: source.adapter as Source["adapter"],
    enabled: source.enabled,
    version: source.version,
  };
}

export async function putSource(
  sourceKey: string,
  input: PutSourceRequest,
  repository?: StudyRepository,
): Promise<PutSourceResult> {
  try {
    const result = await repositoryOrDefault(repository).putSource({ sourceKey, ...input });
    if (result.status === "version_conflict") {
      throw new StudyServiceError(409, "VERSION_CONFLICT", "소스 버전이 변경되었습니다.");
    }
    const source = toSource(result.source);
    return { source, version: source.version };
  } catch (error) {
    throw unavailable(error);
  }
}

export async function listSources(repository?: StudyRepository): Promise<ListSourcesResult> {
  try {
    const sources = await repositoryOrDefault(repository).listSources();
    return { sources: sources.map(toSource) };
  } catch (error) {
    throw unavailable(error);
  }
}

export async function getSourceCursor(
  sourceKey: string,
  mode: CursorMode,
  repository?: StudyRepository,
): Promise<GetSourceCursorResult> {
  try {
    const result = await repositoryOrDefault(repository).getSourceCursor(sourceKey, mode);
    if (!result) throw new StudyServiceError(404, "NOT_FOUND", "소스를 찾을 수 없습니다.");
    return {
      sourceKey,
      mode,
      cursor: result.cursor?.cursor ?? null,
      version: result.cursor?.version ?? 0,
    };
  } catch (error) {
    throw unavailable(error);
  }
}
