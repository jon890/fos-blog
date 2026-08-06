// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PostCardSkeleton } from "./PostCardSkeleton";

afterEach(cleanup);

describe("PostCardSkeleton", () => {
  it("기본값은 행형 구조를 사용한다", () => {
    const { container } = render(<PostCardSkeleton />);
    const skeleton = container.firstElementChild;

    expect(skeleton?.className).toContain("grid-cols-[112px_minmax(0,1fr)]");
    expect(skeleton?.className).not.toContain("flex-col");
  });

  it("grid를 명시하면 16:9 이미지가 먼저 오는 카드형 구조를 사용한다", () => {
    const { container } = render(<PostCardSkeleton variant="grid" />);
    const skeleton = container.firstElementChild;

    expect(skeleton?.className).toContain("flex-col");
    expect(skeleton?.firstElementChild?.className).toContain("aspect-video");
  });
});
