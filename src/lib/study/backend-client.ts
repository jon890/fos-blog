import type { ZodType } from "zod";
import { env } from "@/env";
import logger from "@/lib/logger";
import {
  getMaterialResponseSchema,
  getRecommendationRunResponseSchema,
  importCommitResponseSchema,
  importDryRunResponseSchema,
  listMaterialsResponseSchema,
  listRecommendationRunsResponseSchema,
  listSourcesResponseSchema,
  studyErrorResponseSchema,
  updateMaterialStateResponseSchema,
  type GetRecommendationRunResult,
  type ImportCommitRequest,
  type ImportCommitResult,
  type ImportDryRunRequest,
  type ImportDryRunResult,
  type ListRecommendationRunsResult,
  type Material,
  type MaterialState,
  type StudyErrorCode,
  type StudyMaterialQuery,
  type StudyRecommendationRunQuery,
  type StudySourceSummary,
  type UpdateMaterialStateRequest,
} from "./contracts";

// 브라우저 번들 유입을 막는다. `server-only` 패키지를 새로 넣지 않고 같은 경계를 지킨다.
// 관리자 화면은 Server Action 으로만 이 모듈에 닿으므로 정상 경로에서는 실행되지 않는다.
if (typeof window !== "undefined") {
  throw new Error("학습자료 Backend client 는 서버에서만 사용할 수 있습니다.");
}

/** 새 Backend 는 기존 fos-blog 경로와 DTO 를 그대로 구현한다. */
export const STUDY_BACKEND_BASE_PATH = "/api/study/v1";
const DEFAULT_TIMEOUT_MS = 10_000;
const log = logger.child({ module: "study/backend-client" });

export class StudyBackendError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: StudyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StudyBackendError";
  }
}

export type StudyBackendOptions = {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type StudyBackendConfig = {
  baseUrl: string;
  token: string;
  timeoutMs: number;
  fetchImpl: typeof fetch;
};

function resolveConfig(options: StudyBackendOptions = {}): StudyBackendConfig {
  const baseUrl = options.baseUrl ?? env.CAREER_STUDY_BACKEND_URL;
  const token = options.token ?? env.CAREER_STUDY_BACKEND_TOKEN;
  if (!baseUrl || !token) {
    throw new StudyBackendError(503, "UNAVAILABLE", "학습자료 Backend 설정이 없습니다.");
  }
  return {
    baseUrl,
    token,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    fetchImpl: options.fetchImpl ?? fetch,
  };
}

/** base URL 의 경로 접두사를 유지한 채 기존 상대 경로를 결합한다. */
export function studyBackendUrl(baseUrl: string, path: string, query?: URLSearchParams): string {
  const base = new URL(baseUrl);
  const prefix = base.pathname.replace(/\/+$/, "");
  const url = new URL(`${prefix}${STUDY_BACKEND_BASE_PATH}${path}`, base);
  const search = query?.toString();
  if (search) url.search = search;
  return url.toString();
}

function codeForStatus(status: number): StudyErrorCode {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "VERSION_CONFLICT";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 429) return "RATE_LIMITED";
  if (status === 400) return "INVALID_REQUEST";
  return "UNAVAILABLE";
}

async function readErrorEnvelope(response: Response): Promise<StudyBackendError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  const parsed = studyErrorResponseSchema.safeParse(payload);
  if (parsed.success) {
    return new StudyBackendError(response.status, parsed.data.error.code, parsed.data.error.message);
  }
  return new StudyBackendError(
    response.status,
    codeForStatus(response.status),
    "학습자료 요청을 처리하지 못했습니다.",
  );
}

type StudyBackendRequest = {
  operation: string;
  path: string;
  query?: URLSearchParams;
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
};

/**
 * 요청 URL, Bearer token, 메모와 import 본문은 로그에 남기지 않는다.
 * 실패 로그에는 동작 이름, HTTP 상태와 오류 code 만 넣는다.
 */
async function requestBackend<T>(
  request: StudyBackendRequest,
  schema: ZodType<T>,
  options: StudyBackendOptions,
): Promise<T> {
  const config = resolveConfig(options);
  const method = request.method ?? "GET";
  let response: Response;
  try {
    response = await config.fetchImpl(studyBackendUrl(config.baseUrl, request.path, request.query), {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(config.timeoutMs),
      headers: {
        authorization: `Bearer ${config.token}`,
        accept: "application/json",
        ...(request.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    });
  } catch {
    log.warn({ operation: request.operation }, "학습자료 Backend 에 연결하지 못했습니다.");
    throw new StudyBackendError(503, "UNAVAILABLE", "학습자료 Backend 에 연결하지 못했습니다.");
  }

  if (!response.ok) {
    const error = await readErrorEnvelope(response);
    log.warn(
      { operation: request.operation, status: error.status, code: error.code },
      "학습자료 Backend 요청이 실패했습니다.",
    );
    throw error;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    log.warn({ operation: request.operation }, "학습자료 Backend 응답을 읽지 못했습니다.");
    throw new StudyBackendError(503, "UNAVAILABLE", "학습자료 Backend 응답을 읽지 못했습니다.");
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    log.warn({ operation: request.operation }, "학습자료 Backend 응답 형식이 올바르지 않습니다.");
    throw new StudyBackendError(503, "UNAVAILABLE", "학습자료 Backend 응답 형식이 올바르지 않습니다.");
  }
  return parsed.data;
}

function materialQueryParams(query: StudyMaterialQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.q) params.set("q", query.q);
  if (query.sourceKey) params.set("sourceKey", query.sourceKey);
  if (query.category) params.set("category", query.category);
  if (query.kind) params.set("kind", query.kind);
  if (query.starred !== undefined) params.set("starred", String(query.starred));
  if (query.read !== undefined) params.set("read", String(query.read));
  if (query.recommended !== undefined) params.set("recommended", String(query.recommended));
  if (query.publishedFrom) params.set("publishedFrom", query.publishedFrom);
  if (query.publishedTo) params.set("publishedTo", query.publishedTo);
  return params;
}

export async function listStudyMaterials(
  query: StudyMaterialQuery,
  options: StudyBackendOptions = {},
) {
  return requestBackend(
    { operation: "listMaterials", path: "/materials", query: materialQueryParams(query) },
    listMaterialsResponseSchema,
    options,
  );
}

export async function getStudyMaterial(
  materialId: number,
  options: StudyBackendOptions = {},
): Promise<Material> {
  const result = await requestBackend(
    { operation: "getMaterial", path: `/materials/${encodeURIComponent(String(materialId))}` },
    getMaterialResponseSchema,
    options,
  );
  return result.material;
}

export async function listStudySources(
  options: StudyBackendOptions = {},
): Promise<StudySourceSummary[]> {
  const result = await requestBackend(
    { operation: "listSources", path: "/sources" },
    listSourcesResponseSchema,
    options,
  );
  return result.sources.map(({ sourceKey, title }) => ({ sourceKey, sourceName: title }));
}

export async function updateStudyMaterialState(
  materialId: number,
  body: UpdateMaterialStateRequest,
  options: StudyBackendOptions = {},
): Promise<MaterialState> {
  const result = await requestBackend(
    {
      operation: "updateMaterialState",
      path: `/materials/${encodeURIComponent(String(materialId))}/state`,
      method: "PATCH",
      body,
    },
    updateMaterialStateResponseSchema,
    options,
  );
  return result.state;
}

export async function listStudyRecommendationRuns(
  query: StudyRecommendationRunQuery,
  options: StudyBackendOptions = {},
): Promise<ListRecommendationRunsResult> {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", query.cursor);
  return requestBackend(
    { operation: "listRecommendationRuns", path: "/recommendation-runs", query: params },
    listRecommendationRunsResponseSchema,
    options,
  );
}

export async function getStudyRecommendationRun(
  reportId: string,
  options: StudyBackendOptions = {},
): Promise<GetRecommendationRunResult> {
  return requestBackend(
    {
      operation: "getRecommendationRun",
      path: `/recommendation-runs/${encodeURIComponent(reportId)}`,
    },
    getRecommendationRunResponseSchema,
    options,
  );
}

export async function dryRunStudyImport(
  payload: ImportDryRunRequest,
  options: StudyBackendOptions = {},
): Promise<ImportDryRunResult> {
  return requestBackend(
    { operation: "importDryRun", path: "/imports/dry-run", method: "POST", body: payload },
    importDryRunResponseSchema,
    options,
  );
}

export async function commitStudyImport(
  payload: ImportCommitRequest,
  options: StudyBackendOptions = {},
): Promise<ImportCommitResult> {
  return requestBackend(
    { operation: "importCommit", path: "/imports/commit", method: "POST", body: payload },
    importCommitResponseSchema,
    options,
  );
}
