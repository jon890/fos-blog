// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MaterialState } from "@/lib/study/contracts";
import { MaterialStateEditor, type DesiredMaterialState, type MaterialStateSaveResult } from "./MaterialStateEditor";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const state: MaterialState = { starred: false, read: false, note: "처음 메모", version: 3, updatedAt: null };

describe("MaterialStateEditor", () => {
  it("키보드 조작으로 원하는 최종 상태와 버전을 저장하고 성공을 안내한다", async () => {
    const onSave = vi.fn<(input: DesiredMaterialState) => Promise<MaterialStateSaveResult>>().mockResolvedValue({ status: "saved", state: { ...state, starred: true, read: true, note: "새 메모", version: 4 } });
    render(<MaterialStateEditor state={state} onSave={onSave} />);
    const user = userEvent.setup();

    await user.tab();
    await user.keyboard(" ");
    await user.tab();
    await user.keyboard(" ");
    await user.tab();
    await user.clear(screen.getByLabelText("메모"));
    await user.type(screen.getByLabelText("메모"), "새 메모");
    await user.tab();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ expectedVersion: 3, starred: true, read: true, note: "새 메모" }));
    expect(screen.getByRole("status").textContent).toContain("저장했습니다");
  });

  it("저장 중 중복 클릭을 막는다", async () => {
    let resolve: (value: MaterialStateSaveResult) => void = () => undefined;
    const onSave = vi.fn().mockReturnValue(new Promise<MaterialStateSaveResult>((done) => { resolve = done; }));
    render(<MaterialStateEditor state={state} onSave={onSave} />);

    const button = screen.getByRole("button", { name: "상태와 메모 저장" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(button.hasAttribute("disabled")).toBe(true);
    resolve({ status: "saved", state });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("저장했습니다"));
  });

  it("409 충돌과 네트워크 실패 뒤에도 초안을 유지하고 최신 상태를 안내한다", async () => {
    const onSave = vi.fn()
      .mockResolvedValueOnce({ status: "conflict", latestState: { starred: true, read: true, note: "다른 기기 메모", version: 4, updatedAt: null } })
      .mockRejectedValueOnce(new Error("network"));
    render(<MaterialStateEditor state={state} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "내 초안" } });
    fireEvent.click(screen.getByRole("button", { name: "상태와 메모 저장" }));
    await waitFor(() => expect(screen.getByLabelText("최신 상태").textContent).toContain("다른 기기 메모"));
    expect((screen.getByLabelText("메모") as HTMLTextAreaElement).value).toBe("내 초안");

    fireEvent.click(screen.getByRole("button", { name: "상태와 메모 저장" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("확인하지 못했습니다"));
    expect((screen.getByLabelText("메모") as HTMLTextAreaElement).value).toBe("내 초안");
  });
});
