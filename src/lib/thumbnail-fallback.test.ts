import { describe, expect, it } from "vitest";
import { createThumbnailPattern } from "./thumbnail-fallback";

describe("createThumbnailPattern", () => {
  it("같은 category에는 같은 패턴을 만든다", () => {
    expect(createThumbnailPattern("AI")).toEqual(createThumbnailPattern("AI"));
  });

  it("다른 category에는 다른 패턴을 만든다", () => {
    expect(createThumbnailPattern("AI")).not.toEqual(createThumbnailPattern("java"));
  });

  it("빈 category도 안전한 패턴을 만든다", () => {
    const pattern = createThumbnailPattern("");

    expect(pattern.nodes).toHaveLength(7);
    expect(pattern.hue).toBeGreaterThanOrEqual(0);
    expect(pattern.hue).toBeLessThan(360);
  });
});
