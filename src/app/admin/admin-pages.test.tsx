// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAdminSession, requireAdminPage, redirect } = vi.hoisted(() => ({
  getAdminSession: vi.fn(), requireAdminPage: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));
vi.mock("@/lib/admin/session", () => ({ getAdminSession, requireAdminPage }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/admin/client", () => ({ adminAuthClient: { signIn: { social: vi.fn() }, signOut: vi.fn() } }));

import AdminLoginPage from "./login/page";
import AdminHomePage from "./(protected)/page";
import ProtectedAdminLayout from "./(protected)/layout";
import AdminError from "./error";

const session = { user: { id: "PRIVATE_LOCAL_USER_ID", name: "Fixture Admin" }, session: { id: "PRIVATE_SESSION_ID", expiresAt: new Date("2030-01-01") } };
beforeEach(() => { vi.clearAllMocks(); getAdminSession.mockResolvedValue({ status: "unauthenticated" }); requireAdminPage.mockResolvedValue(session); });
afterEach(cleanup);

describe("관리자 페이지", () => {
  it("익명에게 로그인 버튼을 표시한다", async () => {
    render(await AdminLoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("관리자 로그인");
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
  });

  it("이미 허용된 본인 세션은 홈으로 이동한다", async () => {
    getAdminSession.mockResolvedValue({ status: "authenticated", data: session });
    await expect(AdminLoginPage({ searchParams: Promise.resolve({ error: "access_denied" }) })).rejects.toThrow("REDIRECT:/admin");
  });

  it.each([
    ["access_denied", "로그인을 취소했습니다"],
    ["admin_account_not_allowed", "관리자 권한이 없는 계정"],
    ["authentication_failed", "인증을 완료하지 못했습니다"],
    ["<script>PRIVATE_DETAIL</script>", "인증을 완료하지 못했습니다"],
    ["constructor", "인증을 완료하지 못했습니다"],
    [["access_denied", "PRIVATE_DETAIL"], "인증을 완료하지 못했습니다"],
  ])("허용 목록에서만 오류 안내를 선택한다: %j", async (error, text) => {
    render(await AdminLoginPage({ searchParams: Promise.resolve({ error }) }));
    expect(document.body.textContent).toContain(text);
    expect(document.body.textContent).not.toContain("PRIVATE_DETAIL");
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
  });

  it("현재 허용되지 않은 세션에 권한 없음을 안내한다", async () => {
    getAdminSession.mockResolvedValue({ status: "forbidden" });
    render(await AdminLoginPage({ searchParams: Promise.resolve({}) }));
    expect(document.body.textContent).toContain("관리자 권한이 없는 계정");
  });

  it.each([["configuration", "관리자 인증 설정이 필요합니다"], ["database", "관리자 세션을 확인하지 못했습니다"]])("%s 장애는 로그인 시도로 숨기지 않는다", async (reason, text) => {
    getAdminSession.mockResolvedValue({ status: "unavailable", reason });
    render(await AdminLoginPage({ searchParams: Promise.resolve({}) }));
    expect(document.body.textContent).toContain(text);
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("link", { name: "다시 확인" }).getAttribute("href")).toBe("/admin/login");
  });

  it("홈과 layout은 각각 서버 검사를 통과한 경우에만 본인 계정과 공부 메뉴를 표시한다", async () => {
    const page = await AdminHomePage();
    render(await ProtectedAdminLayout({ children: page }));
    expect(document.body.textContent).toContain("Fixture Admin");
    expect(screen.getByRole("link", { name: "공부 열기" }).getAttribute("href")).toBe("/admin/study");
    expect(screen.getByRole("link", { name: "추천 이력 열기" }).getAttribute("href")).toBe("/admin/study/recommendations");
    expect(screen.getByRole("link", { name: "이력 가져오기 열기" }).getAttribute("href")).toBe("/admin/study/imports");
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeDefined();
    expect(document.querySelector("img, input, script")).toBeNull();
    expect(document.body.textContent).not.toContain("PRIVATE_");
  });

  it.each(["REDIRECT:/admin/login", "REDIRECT:/admin/login?error=admin_account_not_allowed", "세션 저장소 장애", "관리자 인증 설정이 필요합니다"])("페이지와 layout 모두 서버 거절을 전파한다: %s", async (message) => {
    requireAdminPage.mockRejectedValue(new Error(message));
    await expect(AdminHomePage()).rejects.toThrow(message);
    await expect(ProtectedAdminLayout({ children: <p>PRIVATE_CHILD</p> })).rejects.toThrow(message);
    expect(document.body.textContent).not.toContain("PRIVATE_CHILD");
  });

  it("상위 오류 경계는 원문을 숨기고 키보드 재시도와 로그인 복귀를 제공한다", async () => {
    const reset = vi.fn();
    render(<AdminError error={Object.assign(new Error("PRIVATE_DB_DETAIL"), { digest: "PRIVATE_DIGEST" })} reset={reset} />);
    expect(screen.getByRole("alert").textContent).toContain("관리자 인증 설정이나 세션 저장소");
    expect(document.body.textContent).not.toContain("PRIVATE_");
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "다시 시도" }));
    await user.keyboard("{Enter}");
    expect(reset).toHaveBeenCalled();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/admin/login");
  });
});
