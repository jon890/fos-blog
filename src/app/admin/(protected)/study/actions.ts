"use server";

import { headers } from "next/headers";
import { env } from "@/env";
import { getAdminSession } from "@/lib/admin/session";
import {
  commitStudyImport,
  dryRunStudyImport,
  getStudyMaterial,
  getStudyRecommendationRun,
  listStudyMaterials,
  listStudyRecommendationRuns,
  listStudySources,
  StudyBackendError,
  updateStudyMaterialState,
} from "@/lib/study/backend-client";
import type {
  GetRecommendationRunResult,
  ImportCommitRequest,
  ImportCommitResult,
  ImportDryRunRequest,
  ImportDryRunResult,
  ListRecommendationRunsResult,
  Material,
  MaterialState,
  StudyActionErrorCode,
  StudyActionResult,
  StudyMaterialQuery,
  StudyRecommendationRunQuery,
  StudySourceSummary,
  UpdateMaterialStateRequest,
} from "@/lib/study/contracts";

type ListMaterialsResult = { items: Material[]; nextCursor: string | null };

function failure<T>(code: StudyActionErrorCode, message: string): StudyActionResult<T> {
  return { status: "error", code, message };
}

/** Backend 오류 code 를 화면이 구분하는 결과로 좁힌다. 내부 메시지를 그대로 흘리지 않는다. */
function fromBackendError<T>(error: unknown): StudyActionResult<T> {
  if (!(error instanceof StudyBackendError)) {
    return failure<T>("failed", "학습자료 요청을 처리하지 못했습니다.");
  }
  if (error.code === "UNAUTHENTICATED") {
    return failure<T>("unauthenticated", "로그인이 만료되었습니다. 다시 로그인해 주세요.");
  }
  if (error.code === "FORBIDDEN") {
    return failure<T>("forbidden", "이 요청을 수행할 권한이 없습니다.");
  }
  if (error.code === "NOT_FOUND") {
    return failure<T>("not-found", "요청한 자료를 찾을 수 없습니다.");
  }
  if (error.code === "VERSION_CONFLICT") {
    return failure<T>("conflict", "다른 곳에서 먼저 저장되었습니다. 최신 상태를 확인해 주세요.");
  }
  if (error.code === "IMPORT_CHANGED") {
    return failure<T>("import-changed", "미리보기 이후 이력이 변경되었습니다. 새 미리보기를 실행해 주세요.");
  }
  return failure<T>("failed", error.message);
}

/** 관리자 세션을 확인한다. 실패하면 Backend 를 호출하지 않는다. */
async function requireAdmin<T>(): Promise<StudyActionResult<T> | null> {
  const session = await getAdminSession(await headers());
  if (session.status === "authenticated") return null;
  if (session.status === "unauthenticated") {
    return failure<T>("unauthenticated", "관리자 인증이 필요합니다.");
  }
  if (session.status === "forbidden") {
    return failure<T>("forbidden", "관리자 권한이 없습니다.");
  }
  return failure<T>("failed", "관리자 세션을 확인하지 못했습니다.");
}

/** 쓰기 동작은 기존 API 와 같은 Origin 조건을 유지한다. */
async function requireSameOrigin<T>(): Promise<StudyActionResult<T> | null> {
  let expected: string | null = null;
  try {
    expected = env.BETTER_AUTH_URL ? new URL(env.BETTER_AUTH_URL).origin : null;
  } catch {
    expected = null;
  }
  const origin = (await headers()).get("origin");
  if (!expected || origin !== expected) {
    return failure<T>("forbidden", "요청 출처를 확인하지 못했습니다.");
  }
  return null;
}

async function runAdminRead<T>(operation: () => Promise<T>): Promise<StudyActionResult<T>> {
  const denied = await requireAdmin<T>();
  if (denied) return denied;
  try {
    return { status: "ok", data: await operation() };
  } catch (error) {
    return fromBackendError<T>(error);
  }
}

async function runAdminWrite<T>(operation: () => Promise<T>): Promise<StudyActionResult<T>> {
  const denied = await requireAdmin<T>();
  if (denied) return denied;
  const crossOrigin = await requireSameOrigin<T>();
  if (crossOrigin) return crossOrigin;
  try {
    return { status: "ok", data: await operation() };
  } catch (error) {
    return fromBackendError<T>(error);
  }
}

export async function listStudyMaterialsAction(
  query: StudyMaterialQuery,
): Promise<StudyActionResult<ListMaterialsResult>> {
  return runAdminRead(() => listStudyMaterials(query));
}

export async function getStudyMaterialAction(
  materialId: number,
): Promise<StudyActionResult<Material>> {
  return runAdminRead(() => getStudyMaterial(materialId));
}

export async function listStudySourcesAction(): Promise<StudyActionResult<StudySourceSummary[]>> {
  return runAdminRead(() => listStudySources());
}

export async function updateStudyMaterialStateAction(
  materialId: number,
  input: UpdateMaterialStateRequest,
): Promise<StudyActionResult<MaterialState>> {
  return runAdminWrite(() => updateStudyMaterialState(materialId, input));
}

export async function listStudyRecommendationRunsAction(
  query: StudyRecommendationRunQuery,
): Promise<StudyActionResult<ListRecommendationRunsResult>> {
  return runAdminRead(() => listStudyRecommendationRuns(query));
}

export async function getStudyRecommendationRunAction(
  reportId: string,
): Promise<StudyActionResult<GetRecommendationRunResult>> {
  return runAdminRead(() => getStudyRecommendationRun(reportId));
}

export async function dryRunStudyImportAction(
  payload: ImportDryRunRequest,
): Promise<StudyActionResult<ImportDryRunResult>> {
  return runAdminWrite(() => dryRunStudyImport(payload));
}

export async function commitStudyImportAction(
  payload: ImportCommitRequest,
): Promise<StudyActionResult<ImportCommitResult>> {
  return runAdminWrite(() => commitStudyImport(payload));
}
