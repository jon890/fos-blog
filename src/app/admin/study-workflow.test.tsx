// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GetRecommendationRunResult, StudyActionResult } from "@/lib/study/contracts";
import { RecommendationHistory } from "@/components/study/RecommendationHistory";
import { RecommendationReport } from "@/components/study/RecommendationReport";

const {
  requireAdminPage,
  listStudyMaterialsAction,
  listStudySourcesAction,
  getStudyMaterialAction,
  updateStudyMaterialStateAction,
  listStudyRecommendationRunsAction,
  getStudyRecommendationRunAction,
  dryRunStudyImportAction,
  commitStudyImportAction,
} = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  listStudyMaterialsAction: vi.fn(),
  listStudySourcesAction: vi.fn(),
  getStudyMaterialAction: vi.fn(),
  updateStudyMaterialStateAction: vi.fn(),
  listStudyRecommendationRunsAction: vi.fn(),
  getStudyRecommendationRunAction: vi.fn(),
  dryRunStudyImportAction: vi.fn(),
  commitStudyImportAction: vi.fn(),
}));
vi.mock("@/lib/admin/session", () => ({ requireAdminPage }));
vi.mock("./(protected)/study/actions", () => ({
  listStudyMaterialsAction,
  listStudySourcesAction,
  getStudyMaterialAction,
  updateStudyMaterialStateAction,
  listStudyRecommendationRunsAction,
  getStudyRecommendationRunAction,
  dryRunStudyImportAction,
  commitStudyImportAction,
}));

import ImportHistoryPage from "./(protected)/study/imports/page";
import RecommendationHistoryPage from "./(protected)/study/recommendations/page";
import RecommendationReportPage from "./(protected)/study/recommendations/[reportId]/page";
import { AdminNavigation } from "@/components/admin/AdminNavigation";

const emptyReport: GetRecommendationRunResult = {
  reportId: "report-2026",
  generatedAt: "2026-09-08T00:00:00.000Z",
  topics: [],
  publications: [],
};

function ok<T>(data: T): StudyActionResult<T> {
  return { status: "ok", data };
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.clearAllMocks();
  requireAdminPage.mockResolvedValue({ user: { id: "LOCAL_FIXTURE", name: "Fixture" } });
  getStudyRecommendationRunAction.mockResolvedValue(ok(emptyReport));
  listStudyRecommendationRunsAction.mockResolvedValue(ok({ items: [], nextCursor: null }));
});

describe("관리자 학습자료 화면", () => {
  it("추천 목록, 상세와 가져오기 page에서 보호 layout과 별도로 현재 세션을 다시 확인한다", async () => {
    render(await RecommendationHistoryPage());
    await screen.findByText("아직 추천 실행 이력이 없습니다.");
    render(await RecommendationReportPage({ params: Promise.resolve({ reportId: "report-2026" }) }));
    await screen.findByText("이 추천 실행에는 선택된 주제가 없습니다.");
    render(await ImportHistoryPage());
    expect(screen.getByText("추천 이력 가져오기")).toBeTruthy();
    expect(requireAdminPage).toHaveBeenCalledTimes(3);
  });

  it("세션 재검증 실패를 page가 숨기지 않는다", async () => {
    requireAdminPage.mockRejectedValue(new Error("REDIRECT:/admin/login"));
    await expect(RecommendationHistoryPage()).rejects.toThrow("REDIRECT:/admin/login");
    await expect(RecommendationReportPage({ params: Promise.resolve({ reportId: "report-2026" }) })).rejects.toThrow("REDIRECT:/admin/login");
    await expect(ImportHistoryPage()).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("없는 추천 상세 page는 HTTP 404 경로로 전환한다", async () => {
    getStudyRecommendationRunAction.mockResolvedValue({
      status: "error",
      code: "not-found",
      message: "요청한 자료를 찾을 수 없습니다.",
    });
    await expect(RecommendationReportPage({ params: Promise.resolve({ reportId: "missing-report" }) }))
      .rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("page는 Repository 대신 Server Action 으로만 추천 상세를 조회한다", async () => {
    await RecommendationReportPage({ params: Promise.resolve({ reportId: "report-2026" }) });
    expect(getStudyRecommendationRunAction).toHaveBeenCalledWith("report-2026");
  });

  it("관리자 메뉴의 모든 학습자료 화면을 링크로 제공한다", () => {
    render(<AdminNavigation />);
    expect(screen.getByRole("link", { name: "공부 열기" }).getAttribute("href")).toBe("/admin/study");
    expect(screen.getByRole("link", { name: "추천 이력 열기" }).getAttribute("href")).toBe("/admin/study/recommendations");
    expect(screen.getByRole("link", { name: "이력 가져오기 열기" }).getAttribute("href")).toBe("/admin/study/imports");
  });

  it("추천 목록의 빈 결과와 세션 만료를 각각 구분한다", async () => {
    const listRuns = vi.fn()
      .mockResolvedValueOnce(ok({ items: [], nextCursor: null }))
      .mockResolvedValueOnce({ status: "error", code: "unauthenticated", message: "로그인이 만료되었습니다." });
    const first = render(<RecommendationHistory listRuns={listRuns as never} />);
    await screen.findByText("아직 추천 실행 이력이 없습니다.");
    first.unmount();
    render(<RecommendationHistory listRuns={listRuns as never} />);
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("로그인이 만료되었습니다");
  });

  it("없는 추천 상세를 404 안내로 표시한다", async () => {
    render(
      <RecommendationReport
        reportId="missing-report"
        getReport={vi.fn(async () => ({ status: "error", code: "not-found", message: "없음" })) as never}
        getMaterial={vi.fn() as never}
        saveMaterialState={vi.fn() as never}
      />,
    );
    await waitFor(() => expect(screen.getByText("추천 이력을 찾을 수 없습니다.")).toBeTruthy());
  });
});
