// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { social, assign } = vi.hoisted(() => ({ social: vi.fn(), assign: vi.fn() }));
vi.mock("@/lib/admin/client", () => ({ adminAuthClient: { signIn: { social } } }));
import { AdminLoginButton } from "./AdminLoginButton";

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("location", { assign }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("관리자 로그인 버튼", () => {
  it("키보드로 GitHub 로그인을 시작하고 서버의 승인 URL로 이동한다", async () => {
    const url = "https://github.com/login/oauth/authorize?state=fixture";
    social.mockResolvedValue({ data: { url, redirect: false }, error: null });
    render(<AdminLoginButton />);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button"));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(assign).toHaveBeenCalledWith(url));
    expect(social).toHaveBeenCalledWith({ provider: "github", callbackURL: "/admin", errorCallbackURL: "/admin/login", disableRedirect: true });
    expect(screen.getByRole("status").textContent).toContain("이동하고 있습니다");
  });

  it("진행 중에는 중복 요청을 막는다", async () => {
    social.mockReturnValue(new Promise(() => {}));
    render(<AdminLoginButton />);
    const user = userEvent.setup();
    await user.dblClick(screen.getByRole("button"));
    expect(social).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });

  it.each([
    { data: null, error: { message: "PRIVATE_PROVIDER_DETAIL" } },
    { data: { url: "" }, error: null },
    { data: { url: "javascript:alert(1)" }, error: null },
    { data: { url: "https://example.test/login/oauth/authorize" }, error: null },
  ])("실패나 잘못된 URL은 안전한 안내 후 재시도한다: %j", async (response) => {
    social.mockResolvedValue(response);
    render(<AdminLoginButton />);
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("로그인을 시작하지 못했습니다"));
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
    expect(assign).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("PRIVATE_PROVIDER_DETAIL");
  });

  it("네트워크 오류를 처리하고 설정 부재 시 호출하지 않는다", async () => {
    social.mockRejectedValue(new Error("network"));
    const { rerender } = render(<AdminLoginButton />);
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("다시 시도"));
    social.mockClear();
    rerender(<AdminLoginButton disabled />);
    await userEvent.click(screen.getByRole("button"));
    expect(social).not.toHaveBeenCalled();
  });
});
