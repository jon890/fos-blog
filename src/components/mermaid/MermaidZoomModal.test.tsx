// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MermaidZoomModal } from "./MermaidZoomModal";

afterEach(() => {
  cleanup();
});

const SVG = `<svg role="img" aria-label="chart"><rect width="10" height="10" /></svg>`;

function renderModal(onClose = vi.fn()) {
  render(<MermaidZoomModal svg={SVG} label="다이어그램 확대 보기" onClose={onClose} />);
  return onClose;
}

describe("MermaidZoomModal", () => {
  it("전달받은 svg 를 dialog 안에 렌더한다", () => {
    renderModal();

    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector("svg")).not.toBeNull();
  });

  it("확대 버튼이 배율을 올린다", () => {
    renderModal();

    expect(screen.getByText("100%")).not.toBeNull();
    fireEvent.click(screen.getByLabelText("확대"));
    expect(screen.queryByText("100%")).toBeNull();
    expect(screen.getByText("150%")).not.toBeNull();
  });

  it("원래 크기로 버튼이 배율을 되돌린다", () => {
    renderModal();

    fireEvent.click(screen.getByLabelText("확대"));
    fireEvent.click(screen.getByLabelText("원래 크기로"));
    expect(screen.getByText("100%")).not.toBeNull();
  });

  it("배율에 하한이 있다", () => {
    renderModal();

    for (let i = 0; i < 10; i += 1) {
      fireEvent.click(screen.getByLabelText("축소"));
    }
    expect(screen.getByText("50%")).not.toBeNull();
  });

  it("ESC 키로 닫는다", () => {
    const onClose = renderModal();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("닫기 버튼으로 닫는다", () => {
    const onClose = renderModal();

    fireEvent.click(screen.getByLabelText("닫기"));
    expect(onClose).toHaveBeenCalled();
  });

  it("다이어그램 밖을 탭하면 닫는다", () => {
    const onClose = renderModal();
    const stage = document.querySelector(".mermaid-zoom-stage") as HTMLElement;
    stage.setPointerCapture = () => {};

    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 11, clientY: 12 });

    expect(onClose).toHaveBeenCalled();
  });

  it("끌어서 이동한 뒤에는 닫지 않는다", () => {
    const onClose = renderModal();
    const stage = document.querySelector(".mermaid-zoom-stage") as HTMLElement;
    stage.setPointerCapture = () => {};

    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 90, clientY: 60 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 90, clientY: 60 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("다이어그램을 탭하면 닫지 않는다", () => {
    const onClose = renderModal();
    const stage = document.querySelector(".mermaid-zoom-stage") as HTMLElement;
    stage.setPointerCapture = () => {};
    const svg = stage.querySelector("svg") as SVGSVGElement;

    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 10, clientY: 10 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("Tab 포커스를 모달 안에 묶는다", () => {
    renderModal();
    const buttons = screen.getAllByRole("button");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("열려 있는 동안 배경 스크롤을 잠그고 닫을 때 되돌린다", () => {
    const { unmount } = render(
      <MermaidZoomModal svg={SVG} label="다이어그램 확대 보기" onClose={vi.fn()} />,
    );

    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
