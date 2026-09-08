// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Material } from "@/lib/study/contracts";
import { MaterialList } from "./MaterialList";

afterEach(cleanup);

function material(id: number): Material {
  return {
    id,
    contentKey: `url:${id}`,
    canonicalUrl: `https://example.test/${id}`,
    title: `자료 ${id}`,
    publishedAt: null,
    excerpt: null,
    tags: [],
    kind: "page-link",
    sources: [],
    state: { starred: false, read: false, note: "", version: 0, updatedAt: null },
    previouslyRecommended: false,
  };
}

describe("MaterialList", () => {
  it("빈 자료에는 검색 결과 없음 안내를 표시한다", () => {
    render(<MaterialList materials={[]} onSaveState={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("조건에 맞는 자료가 없습니다");
  });

  it("누적 자료를 모바일 한 열과 PC 확장 class로 모두 표시한다", () => {
    render(<MaterialList materials={[material(1), material(2)]} onSaveState={vi.fn()} />);
    const list = screen.getByRole("feed");
    expect(list.className).toContain("grid-cols-1");
    expect(list.className).toContain("md:grid-cols-2");
    expect(screen.getByText("자료 1")).toBeTruthy();
    expect(screen.getByText("자료 2")).toBeTruthy();
    const ids = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[id], textarea[id]")]
      .map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
