// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecommendationHistory } from "@/components/study/RecommendationHistory";
import { RecommendationReport } from "@/components/study/RecommendationReport";

const { requireAdminPage } = vi.hoisted(() => ({ requireAdminPage: vi.fn() }));
vi.mock("@/lib/admin/session", () => ({ requireAdminPage }));

import ImportHistoryPage from "./(protected)/study/imports/page";
import RecommendationHistoryPage from "./(protected)/study/recommendations/page";
import RecommendationReportPage from "./(protected)/study/recommendations/[reportId]/page";
import { AdminNavigation } from "@/components/admin/AdminNavigation";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.clearAllMocks();
  requireAdminPage.mockResolvedValue({ user: { id: "LOCAL_FIXTURE", name: "Fixture" } });
});

describe("관리자 학습자료 화면", () => {
  it("추천 목록, 상세와 가져오기 page에서 보호 layout과 별도로 현재 세션을 다시 확인한다", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("report-2026")
      ? new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404 })
      : new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 }))));
    render(await RecommendationHistoryPage());
    await screen.findByText("아직 추천 실행 이력이 없습니다.");
    render(await RecommendationReportPage({ params: Promise.resolve({ reportId: "report-2026" }) }));
    await screen.findByText("추천 이력을 찾을 수 없습니다.");
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

  it("관리자 메뉴의 모든 학습자료 화면을 링크로 제공한다", () => {
    render(<AdminNavigation />);
    expect(screen.getByRole("link", { name: "공부 열기" }).getAttribute("href")).toBe("/admin/study");
    expect(screen.getByRole("link", { name: "추천 이력 열기" }).getAttribute("href")).toBe("/admin/study/recommendations");
    expect(screen.getByRole("link", { name: "이력 가져오기 열기" }).getAttribute("href")).toBe("/admin/study/imports");
  });

  it("추천 목록의 빈 결과와 세션 만료를 각각 구분한다", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED" } }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<RecommendationHistory />);
    await screen.findByText("아직 추천 실행 이력이 없습니다.");
    first.unmount();
    render(<RecommendationHistory />);
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("로그인이 만료되었습니다");
  });

  it("없는 추천 상세를 404 안내로 표시한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404 })));
    render(<RecommendationReport reportId="missing-report" />);
    await waitFor(() => expect(screen.getByText("추천 이력을 찾을 수 없습니다.")).toBeTruthy());
  });
});
