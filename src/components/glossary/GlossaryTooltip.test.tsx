// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlossaryTooltip } from "./GlossaryTooltip";

afterEach(cleanup);

function renderTooltip(id = "llm", term = "LLM") {
  return render(
    <GlossaryTooltip
      id={id}
      term={term}
      fullName="Large Language Model"
      summary="대규모 언어 모델"
    >
      {term}
    </GlossaryTooltip>,
  );
}

describe("GlossaryTooltip", () => {
  it("hover와 focus로 열고 aria-describedby를 tooltip id와 연결한다", async () => {
    const user = userEvent.setup();
    renderTooltip();
    const trigger = screen.getByTitle(/Large Language Model/);

    await user.hover(trigger);
    const tooltip = screen.getByRole("tooltip");
    expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);
    expect(screen.getByText("(Large Language Model)")).toBeTruthy();
    expect(screen.getByRole("link", { name: "용어집에서 보기" })).toHaveProperty(
      "href",
      "http://localhost:3000/glossary#llm",
    );

    await user.unhover(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.tab();
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("click으로 열고 바깥 pointer로 닫는다", async () => {
    const user = userEvent.setup();
    renderTooltip();
    await user.click(screen.getByTitle(/Large Language Model/));
    expect(screen.getByRole("tooltip")).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("ESC로 닫고 trigger에 focus를 유지한다", async () => {
    const user = userEvent.setup();
    renderTooltip();
    const trigger = screen.getByTitle(/Large Language Model/);
    trigger.focus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("다른 glossary tooltip이 열리면 기존 tooltip을 닫는다", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <GlossaryTooltip id="llm" term="LLM" summary="언어 모델">
          LLM
        </GlossaryTooltip>
        <GlossaryTooltip id="rag" term="RAG" summary="검색 증강 생성">
          RAG
        </GlossaryTooltip>
      </div>,
    );

    const [llm, rag] = screen.getAllByTitle(/:/);
    await user.hover(llm);
    expect(screen.getByRole("tooltip").textContent).toContain("언어 모델");
    await user.hover(rag);
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(screen.getByRole("tooltip").textContent).toContain("검색 증강 생성");
  });
});
