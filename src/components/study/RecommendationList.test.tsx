// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecommendationRunSummary } from "@/lib/study/contracts";
import { RecommendationList } from "./RecommendationList";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const items: RecommendationRunSummary[] = [
  { reportId: "morning-2026-09-08", generatedAt: "2026-09-08T00:00:00.000Z", topicCount: 2 },
];

describe("RecommendationList", () => {
  it("생성일과 주제 수를 표시하고 상세 이력으로 이동한다", () => {
    render(<RecommendationList items={items} nextCursor={null} />);

    expect(screen.getByRole("link", { name: /morning-2026-09-08/ }).getAttribute("href")).toBe("/admin/study/recommendations/morning-2026-09-08");
    expect(screen.getByText(/생성일.*2026/).textContent).toContain("주제 2개");
  });

  it("빈 추천 실행을 정상 이력으로 표시하고 키보드로 더 보기를 실행한다", async () => {
    const onLoadMore = vi.fn();
    render(<RecommendationList items={[{ ...items[0], topicCount: 0 }]} nextCursor="next" onLoadMore={onLoadMore} />);
    const user = userEvent.setup();

    expect(screen.getByText(/주제 0개/)).toBeTruthy();
    screen.getByRole("button", { name: "더 보기" }).focus();
    await user.keyboard("{Enter}");
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("이력이 전혀 없을 때 빈 상태를 표시한다", () => {
    render(<RecommendationList items={[]} nextCursor={null} />);
    expect(screen.getByRole("status").textContent).toContain("추천 실행 이력이 없습니다");
  });
});
