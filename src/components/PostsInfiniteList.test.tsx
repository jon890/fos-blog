// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostItem } from "./PostsInfiniteList";
import { PostsInfiniteList } from "./PostsInfiniteList";

vi.mock("./PostCard", () => ({
  PostCard: ({
    post,
    variant = "row",
    preloadThumbnail = false,
  }: {
    post: PostItem;
    variant?: "row" | "grid" | "featured";
    preloadThumbnail?: boolean;
  }) => (
    <article
      data-testid="post-card"
      data-variant={variant}
      data-preload={preloadThumbnail ? "true" : "false"}
    >
      {post.title}
    </article>
  ),
}));

vi.mock("./PostCardSkeleton", () => ({
  PostCardSkeleton: ({ variant = "row" }: { variant?: "row" | "grid" }) => (
    <div data-testid="post-card-skeleton" data-variant={variant} />
  ),
}));

vi.mock("./BackToTopButton", () => ({
  BackToTopButton: () => <button type="button">맨 위로</button>,
}));

class IntersectionObserverMock {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];

  constructor(_callback: IntersectionObserverCallback) {}

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [];
}

function createItem(id: number): PostItem {
  return {
    title: `글 ${id}`,
    path: `AI/post-${id}.md`,
    slug: `AI/post-${id}`,
    category: "AI",
    createdAt: new Date(`2026-08-0${id}T00:00:00.000Z`),
    visitCount: id * 10,
  };
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PostsInfiniteList", () => {
  it("latest의 초기 항목과 추가 조회 항목을 모두 grid로 표시한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [createItem(2)], nextCursor: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PostsInfiniteList
        mode="latest"
        initialItems={[createItem(1)]}
        initialNextCursor="2026-08-01T00:00:00.000Z:1"
      />,
    );

    expect(screen.getByTestId("post-card").getAttribute("data-variant")).toBe(
      "grid",
    );
    expect(screen.getByRole("feed").className).toContain("md:grid-cols-2");
    expect(screen.getByRole("feed").className).toContain("xl:grid-cols-3");
    expect(screen.getByRole("feed").className).not.toContain("lg:grid-cols-3");

    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));

    await waitFor(() => expect(screen.getAllByTestId("post-card")).toHaveLength(2));
    expect(
      screen.getAllByTestId("post-card").map((card) => card.getAttribute("data-variant")),
    ).toEqual(["grid", "grid"]);
    expect(
      screen.getAllByTestId("post-card").map((card) => card.getAttribute("data-preload")),
    ).toEqual(["true", "false"]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/posts/latest"));
  });

  it("popular의 초기 항목과 추가 조회 항목을 모두 row로 표시한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [createItem(2)], nextOffset: 2, hasMore: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PostsInfiniteList
        mode="popular"
        initialItems={[createItem(1)]}
        initialOffset={1}
        initialHasMore
      />,
    );

    expect(screen.getByTestId("post-card").getAttribute("data-variant")).toBe(
      "row",
    );

    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));

    await waitFor(() => expect(screen.getAllByTestId("post-card")).toHaveLength(2));
    expect(
      screen.getAllByTestId("post-card").map((card) => card.getAttribute("data-variant")),
    ).toEqual(["row", "row"]);
    expect(
      screen.getAllByTestId("post-card").map((card) => card.getAttribute("data-preload")),
    ).toEqual(["true", "false"]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/posts/popular"));
  });

  it.each([
    { mode: "latest" as const, expectedVariant: "grid" },
    { mode: "popular" as const, expectedVariant: "row" },
  ])("$mode 로딩 상태는 $expectedVariant 골격을 세 개 사용한다", ({ mode, expectedVariant }) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));

    if (mode === "latest") {
      render(
        <PostsInfiniteList
          mode="latest"
          initialItems={[createItem(1)]}
          initialNextCursor="cursor"
        />,
      );
    } else {
      render(
        <PostsInfiniteList
          mode="popular"
          initialItems={[createItem(1)]}
          initialOffset={1}
          initialHasMore
        />,
      );
    }

    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));

    const skeletons = screen.getAllByTestId("post-card-skeleton");
    expect(skeletons).toHaveLength(3);
    expect(skeletons.map((skeleton) => skeleton.getAttribute("data-variant"))).toEqual([
      expectedVariant,
      expectedVariant,
      expectedVariant,
    ]);
    if (mode === "latest") {
      expect(skeletons[0].parentElement?.className).toContain("md:grid-cols-2");
      expect(skeletons[0].parentElement?.className).toContain("xl:grid-cols-3");
      expect(skeletons[0].parentElement?.className).not.toContain("lg:grid-cols-3");
    }
  });

  it("요청 실패 뒤 재시도하고 완료 안내를 표시한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [createItem(2)], nextCursor: null }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PostsInfiniteList
        mode="latest"
        initialItems={[createItem(1)]}
        initialNextCursor="cursor"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    const retryButton = await screen.findByRole("button", { name: "재시도" });
    fireEvent.click(retryButton);

    await waitFor(() => expect(screen.getAllByTestId("post-card")).toHaveLength(2));
    expect(screen.getByRole("status").textContent).toContain("더 이상 글이 없습니다.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
