// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GetRecommendationRunResult } from "@/lib/study/contracts";
import { RecommendationDetail } from "./RecommendationDetail";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const report: GetRecommendationRunResult = {
  reportId: "legacy-2024-01-01",
  generatedAt: "2024-01-01T00:00:00.000Z",
  topics: [{
    topicKey: "backend-design",
    title: "백엔드 설계",
    careerQuestion: null,
    items: [{
      materialId: 11,
      contentKey: "url:fixture",
      title: "<img src=x onerror=alert(1)>추천 당시 제목",
      canonicalUrl: "https://example.test/article",
      summary: null,
      reason: null,
      careerValue: null,
      state: { starred: false, read: false, note: "현재 메모", version: 2, updatedAt: null },
    }],
  }],
  publications: [{ publicationId: 1, channel: "blog", publishedAt: "2024-01-02T00:00:00.000Z", externalId: "post-1", url: "https://example.test/post" }],
};

describe("RecommendationDetail", () => {
  it("추천 당시 snapshot과 현재 개인 state 및 과거 null 설명을 구분해 일반 텍스트로 표시한다", () => {
    render(<RecommendationDetail report={report} onSaveState={vi.fn()} />);

    expect(screen.getAllByText(/추천 당시 제목/)).toHaveLength(2);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText(/업무 질문: 기존 이력에 설명 없음/)).toBeTruthy();
    expect(screen.getAllByText("기존 이력에 설명 없음")).toHaveLength(3);
    expect(screen.getByText("현재 개인 상태")).toBeTruthy();
    expect((screen.getByLabelText("메모") as HTMLTextAreaElement).value).toBe("현재 메모");
    expect(screen.getByText("게시 이력")).toBeTruthy();
  });

  it("현재 state 편집은 material ID와 현재 version으로 저장한다", async () => {
    const onSaveState = vi.fn().mockResolvedValue({ status: "saved", state: { ...report.topics[0].items[0].state, starred: true, version: 3 } });
    render(<RecommendationDetail report={report} onSaveState={onSaveState} />);

    fireEvent.click(screen.getByLabelText("즐겨찾기"));
    fireEvent.click(screen.getByRole("button", { name: "상태와 메모 저장" }));
    await waitFor(() => expect(onSaveState).toHaveBeenCalledWith(11, { expectedVersion: 2, starred: true, read: false, note: "현재 메모" }));
  });

  it("빈 추천 실행도 오류 대신 정상 이력으로 보인다", () => {
    render(<RecommendationDetail report={{ ...report, topics: [] }} onSaveState={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("선택된 주제가 없습니다");
  });
});
