// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

const renderMock = vi.fn();

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: (...args: unknown[]) => renderMock(...args),
  },
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", systemTheme: "dark" }),
}));

const { Mermaid } = await import("./Mermaid");

beforeEach(() => {
  renderMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("Mermaid", () => {
  it("렌더에 성공하면 확대 버튼을 함께 보여준다", async () => {
    renderMock.mockResolvedValue({ svg: "<svg><rect /></svg>" });

    render(<Mermaid chart="flowchart LR\n A --> B" />);

    await waitFor(() =>
      expect(screen.queryByLabelText("다이어그램 확대 보기")).not.toBeNull(),
    );
  });

  it("확대 버튼을 누르면 확대 모달이 열린다", async () => {
    renderMock.mockResolvedValue({ svg: "<svg><rect /></svg>" });

    render(<Mermaid chart="flowchart LR\n A --> B" />);

    const button = await waitFor(() =>
      screen.getByLabelText("다이어그램 확대 보기"),
    );
    fireEvent.click(button);

    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("렌더에 실패하면 확대 버튼을 감춘다", async () => {
    renderMock.mockRejectedValue(new Error("bad chart"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Mermaid chart="not a chart" />);

    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(screen.queryByLabelText("다이어그램 확대 보기")).toBeNull();

    consoleError.mockRestore();
  });
});
