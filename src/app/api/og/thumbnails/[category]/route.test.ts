import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/og/thumbnails/[category]", () => {
  it("16:9 PNG 생성 응답과 장기 cache header를 반환한다", async () => {
    const response = await GET(
      new Request("http://localhost/api/og/thumbnails/AI"),
      { params: Promise.resolve({ category: "AI" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toContain("max-age=86400");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1_000);
  });
});
