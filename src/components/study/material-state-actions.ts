"use client";

import type {
  Material,
  MaterialState,
  StudyActionResult,
  UpdateMaterialStateRequest,
} from "@/lib/study/contracts";
import type { DesiredMaterialState, MaterialStateSaveResult } from "./MaterialStateEditor";

/** 자료 화면과 추천 상세가 함께 쓰는 개인 상태 Server Action 묶음이다. */
export type MaterialStateActions = {
  getMaterial: (materialId: number) => Promise<StudyActionResult<Material>>;
  saveMaterialState: (
    materialId: number,
    input: UpdateMaterialStateRequest,
  ) => Promise<StudyActionResult<MaterialState>>;
};

async function recoverLatestState(
  actions: MaterialStateActions,
  materialId: number,
): Promise<MaterialStateSaveResult> {
  const latest = await actions.getMaterial(materialId);
  if (latest.status === "ok") return { status: "conflict", latestState: latest.data.state };
  if (latest.code === "unauthenticated") return { status: "unauthenticated" };
  throw new Error(latest.message);
}

/**
 * 버전 충돌과 응답 유실을 모두 최신 상태 조회로 복구한다.
 * 저장에 성공하면 화면이 보관한 자료에 서버 상태를 그대로 반영하도록 `onSaved` 를 부른다.
 */
export async function saveMaterialStateWithRecovery(
  actions: MaterialStateActions,
  materialId: number,
  input: DesiredMaterialState,
  onSaved: (state: MaterialState) => void,
): Promise<MaterialStateSaveResult> {
  let result: StudyActionResult<MaterialState>;
  try {
    result = await actions.saveMaterialState(materialId, input);
  } catch {
    return recoverLatestState(actions, materialId);
  }
  if (result.status === "ok") {
    onSaved(result.data);
    return { status: "saved", state: result.data };
  }
  if (result.code === "unauthenticated") return { status: "unauthenticated" };
  if (result.code === "conflict") return recoverLatestState(actions, materialId);
  throw new Error(result.message);
}
