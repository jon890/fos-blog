// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PostData } from "@/infra/db/types";
import { PostCard } from "./PostCard";

vi.mock("./PostThumbnail", () => ({
  PostThumbnail: ({
    thumbnailUrl,
    category,
    sizes,
    className,
  }: {
    thumbnailUrl?: string | null;
    category: string;
    sizes: string;
    className?: string;
  }) => (
    <span
      data-testid="post-thumbnail"
      data-thumbnail-url={thumbnailUrl ?? ""}
      data-category={category}
      data-sizes={sizes}
      className={className}
    />
  ),
}));

const description = "목록에서 표시할 소개글입니다.";

const post: PostData = {
  title: "아주 긴 테스트 글 제목",
  path: "AI/테스트 글.md",
  slug: "AI/테스트 글",
  category: "AI",
  categories: ["AI"],
  description,
  thumbnailUrl: "https://example.com/thumbnail.jpg",
  createdAt: new Date("2026-08-05T00:00:00.000Z"),
};

afterEach(cleanup);

describe("PostCard", () => {
  it("기본 row 변형은 소개글과 조회수를 유지한다", () => {
    render(<PostCard post={post} viewCount={1234} />);

    expect(screen.getByRole("heading", { name: post.title })).toBeTruthy();
    expect(screen.getByText(description)).toBeTruthy();
    expect(screen.getAllByText("1,234")).toHaveLength(2);
  });

  it("grid 변형은 소개글을 숨기고 제목을 두 줄로 제한한다", () => {
    render(<PostCard post={post} variant="grid" />);

    expect(screen.queryByText(description)).toBeNull();
    expect(screen.getByRole("heading", { name: post.title }).className).toContain(
      "line-clamp-2",
    );
  });

  it("featured 변형은 이미지 덮개 안에 실제 제목 요소를 표시한다", () => {
    render(<PostCard post={post} variant="featured" viewCount={99} />);

    const heading = screen.getByRole("heading", { name: post.title });
    expect(heading.className).toContain("line-clamp-3");
    expect(heading.closest("div.absolute")).not.toBeNull();
    expect(screen.getByText("99")).toBeTruthy();
  });

  it.each(["row", "grid", "featured"] as const)(
    "%s 변형은 같은 글 링크와 썸네일 입력을 사용한다",
    (variant) => {
      render(<PostCard post={post} variant={variant} />);

      expect(screen.getByRole("link").getAttribute("href")).toBe(
        "/posts/AI/%ED%85%8C%EC%8A%A4%ED%8A%B8%20%EA%B8%80",
      );
      const thumbnail = screen.getByTestId("post-thumbnail");
      expect(thumbnail.getAttribute("data-thumbnail-url")).toBe(post.thumbnailUrl);
      expect(thumbnail.getAttribute("data-category")).toBe(post.category);
      expect(thumbnail.getAttribute("data-sizes")).toBeTruthy();
    },
  );
});
