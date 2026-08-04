// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildThumbnailSources, PostThumbnail } from "./PostThumbnail";

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    unoptimized,
    ...props
  }: React.ComponentProps<"img"> & { fill?: boolean; unoptimized?: boolean }) => (
    <img data-unoptimized={unoptimized ? "true" : "false"} {...props} />
  ),
}));

describe("buildThumbnailSources", () => {
  it("전용 이미지, category 생성 이미지, 사이트 기본 이미지 순서를 유지한다", () => {
    expect(buildThumbnailSources("https://example.com/post.jpg", "AI")).toEqual([
      "https://example.com/post.jpg",
      "/api/og/thumbnails/AI",
      "/og-default.png",
    ]);
  });

  it("전용 이미지가 없으면 category 생성 이미지부터 시작한다", () => {
    expect(buildThumbnailSources(null, "AI/RAG")).toEqual([
      "/api/og/thumbnails/AI%2FRAG",
      "/og-default.png",
    ]);
  });
});

describe("PostThumbnail", () => {
  it("이미지 오류마다 다음 대체 경로로 이동하고 마지막에는 숨긴다", () => {
    const { container } = render(
      <PostThumbnail
        thumbnailUrl="https://example.com/post.jpg"
        category="java"
        sizes="160px"
      />,
    );

    const dedicated = container.querySelector("img");
    expect(dedicated).not.toBeNull();
    expect(dedicated?.getAttribute("src")).toBe("https://example.com/post.jpg");

    fireEvent.error(dedicated!);
    const categoryFallback = container.querySelector("img");
    expect(categoryFallback).not.toBeNull();
    expect(categoryFallback?.getAttribute("src")).toBe("/api/og/thumbnails/java");
    expect(categoryFallback?.getAttribute("data-unoptimized")).toBe("true");

    fireEvent.error(categoryFallback!);
    const siteFallback = container.querySelector("img");
    expect(siteFallback).not.toBeNull();
    expect(siteFallback?.getAttribute("src")).toBe("/og-default.png");

    fireEvent.error(siteFallback!);
    expect(container.querySelector("img")).toBeNull();
  });
});
