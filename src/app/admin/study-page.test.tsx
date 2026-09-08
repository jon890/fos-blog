// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminPage } = vi.hoisted(() => ({ requireAdminPage: vi.fn() }));
vi.mock("@/lib/admin/session", () => ({ requireAdminPage }));
vi.mock("@/components/study/StudyLibrary", () => ({ StudyLibrary: () => <p>자료 화면</p> }));

import StudyPage from "./(protected)/study/page";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("StudyPage", () => {
  it("보호 layout 결과와 관계없이 페이지에서 관리자 세션을 다시 확인한다", async () => {
    requireAdminPage.mockResolvedValue({ user: { id: "LOCAL_FIXTURE", name: "Fixture" } });
    render(await StudyPage());
    expect(requireAdminPage).toHaveBeenCalledOnce();
    expect(screen.getByText("자료 화면")).toBeTruthy();
  });

  it("페이지 자체의 세션 검증 실패를 전파한다", async () => {
    requireAdminPage.mockRejectedValue(new Error("REDIRECT:/admin/login"));
    await expect(StudyPage()).rejects.toThrow("REDIRECT:/admin/login");
  });
});
