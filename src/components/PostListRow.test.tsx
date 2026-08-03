// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PostListRow } from "./PostListRow";

vi.mock("./PostThumbnail", () => ({
  PostThumbnail: ({
    thumbnailUrl,
    category,
  }: {
    thumbnailUrl?: string | null;
    category: string;
  }) => (
    <span
      data-testid="post-thumbnail"
      data-thumbnail-url={thumbnailUrl ?? ""}
      data-category={category}
    />
  ),
}));

describe("PostListRow", () => {
  it("카테고리 목록의 전용 썸네일과 fallback 분류를 전달한다", () => {
    render(
      <PostListRow
        index={1}
        title="테스트 글"
        excerpt="설명"
        href="/posts/test"
        updatedAt={new Date("2026-08-03T00:00:00.000Z")}
        categorySlug="AI"
        thumbnailUrl="https://example.com/thumbnail.jpg"
      />,
    );

    const thumbnail = screen.getByTestId("post-thumbnail");
    expect(thumbnail.getAttribute("data-thumbnail-url")).toBe(
      "https://example.com/thumbnail.jpg",
    );
    expect(thumbnail.getAttribute("data-category")).toBe("AI");
  });
});
