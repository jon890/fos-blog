// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudyFilters, type StudyFiltersValue } from "./StudyFilters";

afterEach(cleanup);

describe("StudyFilters", () => {
  const sources = [{ sourceKey: "spring", sourceName: "Spring Blog" }];

  it("모바일에서 필터를 접고 현재 필터와 초기화 버튼을 유지한다", () => {
    const onApply = vi.fn();
    render(<StudyFilters value={{ q: "transaction", starred: true }} sources={sources} onApply={onApply} />);

    expect(screen.getByText("현재 필터")).toBeTruthy();
    expect(screen.getByText("검색: transaction")).toBeTruthy();
    expect(screen.getByRole("button", { name: "초기화" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "필터 열기" }).getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "필터 열기" }));
    expect(screen.getByRole("button", { name: "필터 접기" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("검색")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(onApply).toHaveBeenCalledWith({});
  });

  it("검색과 필터를 적용하고 빈 조건도 명시적으로 초기화한다", () => {
    const onApply = vi.fn<(value: StudyFiltersValue) => void>();
    render(<StudyFilters value={{}} sources={sources} onApply={onApply} />);

    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "react" } });
    fireEvent.change(screen.getByLabelText("소스"), { target: { value: "spring" } });
    fireEvent.change(screen.getByLabelText("읽음"), { target: { value: "false" } });
    fireEvent.submit(screen.getByRole("button", { name: "필터 적용" }).closest("form")!);

    expect(onApply).toHaveBeenCalledWith({ q: "react", sourceKey: "spring", read: false });
  });
});
