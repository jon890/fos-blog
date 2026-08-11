import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPostsBySeries: vi.fn(),
}));

vi.mock("@/infra/db/repositories", () => ({
  getRepositories: vi.fn(() => ({
    post: { getPostsBySeries: mocks.getPostsBySeries },
  })),
}));

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_SITE_URL: "https://example.com" },
}));

const params = (name: string) => ({ params: Promise.resolve({ name }) });

describe("시리즈 페이지 generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("글이 있는 시리즈는 색인을 막지 않는다", async () => {
    mocks.getPostsBySeries.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params("AI 서비스 실전 구축·운영"));

    expect(metadata.robots).toBeUndefined();
  });

  // 시리즈 이름은 임의 문자열이라, 존재 확인 없이 두면
  // 아무 값이나 넣은 URL 이 전부 색인 대상이 된다.
  it("글이 없는 시리즈는 색인을 막는다", async () => {
    mocks.getPostsBySeries.mockResolvedValue([]);

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params("없는시리즈"));

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("조회가 실패해도 색인을 막는다", async () => {
    mocks.getPostsBySeries.mockRejectedValue(new Error("db down"));

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params("오류"));

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
