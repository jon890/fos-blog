// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signOut, replace } = vi.hoisted(() => ({ signOut: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/admin/client", () => ({ adminAuthClient: { signOut } }));
import { AdminSignOutButton } from "./AdminSignOutButton";

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("location", { replace }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("관리자 로그아웃 버튼", () => {
  it("서버 철회 성공을 기다린 뒤 로그인 화면으로 이동한다", async () => {
    let resolve!: (value: { data: { success: boolean }; error: null }) => void;
    signOut.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<AdminSignOutButton />);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button"));
    await user.keyboard("{Enter}");
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("로그아웃하고 있습니다");
    resolve({ data: { success: true }, error: null });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
  });

  it.each([
    { data: null, error: { status: 503, message: "PRIVATE_DB_DETAIL" } },
    { data: null, error: null },
    { data: { success: false }, error: null },
  ])("실패는 이동하지 않고 재시도할 수 있다: %j", async (response) => {
    signOut.mockResolvedValueOnce(response).mockResolvedValueOnce({ data: { success: true }, error: null });
    render(<AdminSignOutButton />);
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("로그아웃하지 못했습니다"));
    expect(replace).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("PRIVATE_DB_DETAIL");
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
  });

  it("통신 오류도 성공으로 표시하지 않는다", async () => {
    signOut.mockRejectedValue(new Error("network"));
    render(<AdminSignOutButton />);
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("다시 시도"));
    expect(replace).not.toHaveBeenCalled();
  });
});
