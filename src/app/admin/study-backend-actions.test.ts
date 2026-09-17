import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  StudyBackendError: class StudyBackendError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "StudyBackendError";
    }
  },
  getAdminSession: vi.fn(),
  requestHeaders: new Headers(),
  backend: {
    listStudyMaterials: vi.fn(),
    getStudyMaterial: vi.fn(),
    listStudySources: vi.fn(),
    updateStudyMaterialState: vi.fn(),
    listStudyRecommendationRuns: vi.fn(),
    getStudyRecommendationRun: vi.fn(),
    dryRunStudyImport: vi.fn(),
    commitStudyImport: vi.fn(),
  },
}));

const { StudyBackendError } = hoisted;

vi.mock("@/env", () => ({ env: { BETTER_AUTH_URL: "https://blog.example.test" } }));
vi.mock("next/headers", () => ({ headers: async () => hoisted.requestHeaders }));
vi.mock("@/lib/admin/session", () => ({ getAdminSession: hoisted.getAdminSession }));
vi.mock("@/lib/study/backend-client", () => ({ ...hoisted.backend, StudyBackendError: hoisted.StudyBackendError }));

import {
  commitStudyImportAction,
  dryRunStudyImportAction,
  getStudyMaterialAction,
  getStudyRecommendationRunAction,
  listStudyMaterialsAction,
  listStudyRecommendationRunsAction,
  listStudySourcesAction,
  updateStudyMaterialStateAction,
} from "./(protected)/study/actions";

const SITE_ORIGIN = "https://blog.example.test";

function authenticated() {
  return {
    status: "authenticated" as const,
    data: { user: { id: "user", name: "관리자" }, session: { id: "session", expiresAt: new Date() } },
  };
}

function withOrigin(origin: string | null) {
  hoisted.requestHeaders = new Headers(origin === null ? {} : { origin });
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getAdminSession.mockResolvedValue(authenticated());
  withOrigin(SITE_ORIGIN);
});
afterEach(() => vi.clearAllMocks());

describe("관리자 학습자료 Server Action", () => {
  it("익명 요청은 Backend 를 호출하지 않고 재로그인을 알린다", async () => {
    hoisted.getAdminSession.mockResolvedValue({ status: "unauthenticated" });
    await expect(listStudyMaterialsAction({})).resolves.toMatchObject({
      status: "error",
      code: "unauthenticated",
    });
    expect(hoisted.backend.listStudyMaterials).not.toHaveBeenCalled();
  });

  it("허용하지 않은 계정은 권한 없음으로 거절한다", async () => {
    hoisted.getAdminSession.mockResolvedValue({ status: "forbidden" });
    await expect(getStudyMaterialAction(1)).resolves.toMatchObject({ status: "error", code: "forbidden" });
    expect(hoisted.backend.getStudyMaterial).not.toHaveBeenCalled();
  });

  it("세션 장애는 익명과 구분해 일시 실패로 바꾼다", async () => {
    hoisted.getAdminSession.mockResolvedValue({ status: "unavailable", reason: "database" });
    const result = await listStudySourcesAction();
    expect(result).toMatchObject({ status: "error", code: "failed" });
    expect(hoisted.backend.listStudySources).not.toHaveBeenCalled();
  });

  it("관리자 세션이 있으면 Backend 결과를 그대로 돌려준다", async () => {
    hoisted.backend.listStudyMaterials.mockResolvedValue({ items: [], nextCursor: null });
    await expect(listStudyMaterialsAction({ limit: 30 })).resolves.toEqual({
      status: "ok",
      data: { items: [], nextCursor: null },
    });
    expect(hoisted.backend.listStudyMaterials).toHaveBeenCalledWith({ limit: 30 });
  });

  it("쓰기 동작은 다른 출처의 요청을 거절한다", async () => {
    withOrigin("https://evil.example.test");
    await expect(updateStudyMaterialStateAction(1, { expectedVersion: 0, starred: true }))
      .resolves.toMatchObject({ status: "error", code: "forbidden" });
    withOrigin(null);
    await expect(commitStudyImportAction({ importKey: "legacy" } as never))
      .resolves.toMatchObject({ status: "error", code: "forbidden" });
    expect(hoisted.backend.updateStudyMaterialState).not.toHaveBeenCalled();
    expect(hoisted.backend.commitStudyImport).not.toHaveBeenCalled();
  });

  it("같은 출처의 쓰기는 Backend 로 전달한다", async () => {
    hoisted.backend.updateStudyMaterialState.mockResolvedValue({ starred: true, read: false, note: "", version: 1, updatedAt: null });
    await expect(updateStudyMaterialStateAction(1, { expectedVersion: 0, starred: true }))
      .resolves.toMatchObject({ status: "ok" });
    expect(hoisted.backend.updateStudyMaterialState).toHaveBeenCalledWith(1, { expectedVersion: 0, starred: true });
  });

  it("Backend 의 버전 충돌과 없는 자료를 화면이 구분하는 결과로 바꾼다", async () => {
    hoisted.backend.updateStudyMaterialState.mockRejectedValue(new StudyBackendError(409, "VERSION_CONFLICT", "충돌"));
    await expect(updateStudyMaterialStateAction(1, { expectedVersion: 0, read: true }))
      .resolves.toMatchObject({ status: "error", code: "conflict" });

    hoisted.backend.getStudyRecommendationRun.mockRejectedValue(new StudyBackendError(404, "NOT_FOUND", "없음"));
    await expect(getStudyRecommendationRunAction("missing-report"))
      .resolves.toMatchObject({ status: "error", code: "not-found" });
  });

  it("Backend 의 import 이력 변경과 일시 장애를 구분한다", async () => {
    hoisted.backend.commitStudyImport.mockRejectedValue(new StudyBackendError(409, "IMPORT_CHANGED", "변경"));
    await expect(commitStudyImportAction({ importKey: "legacy" } as never))
      .resolves.toMatchObject({ status: "error", code: "import-changed" });

    hoisted.backend.dryRunStudyImport.mockRejectedValue(new StudyBackendError(503, "UNAVAILABLE", "연결 실패"));
    await expect(dryRunStudyImportAction({ importKey: "legacy" } as never))
      .resolves.toMatchObject({ status: "error", code: "failed" });
  });

  it("Backend 의 401 과 403 을 화면의 재로그인과 권한 없음으로 옮긴다", async () => {
    hoisted.backend.listStudyRecommendationRuns.mockRejectedValue(new StudyBackendError(401, "UNAUTHENTICATED", "만료"));
    await expect(listStudyRecommendationRunsAction({ limit: 30 }))
      .resolves.toMatchObject({ status: "error", code: "unauthenticated" });

    hoisted.backend.listStudyRecommendationRuns.mockRejectedValue(new StudyBackendError(403, "FORBIDDEN", "권한 없음"));
    await expect(listStudyRecommendationRunsAction({ limit: 30 }))
      .resolves.toMatchObject({ status: "error", code: "forbidden" });
  });

  it("예상하지 못한 예외는 내부 메시지를 숨기고 일시 실패로 바꾼다", async () => {
    hoisted.backend.getStudyMaterial.mockRejectedValue(new Error("mysql://internal/secret"));
    const result = await getStudyMaterialAction(1);
    expect(result).toEqual({
      status: "error",
      code: "failed",
      message: "학습자료 요청을 처리하지 못했습니다.",
    });
  });
});
