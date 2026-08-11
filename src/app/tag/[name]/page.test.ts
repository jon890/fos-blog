import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countPostsByTag: vi.fn(),
}));

vi.mock("@/infra/db/repositories", () => ({
  getRepositories: vi.fn(() => ({
    post: { countPostsByTag: mocks.countPostsByTag },
  })),
}));

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_SITE_URL: "https://example.com" },
}));

const params = (name: string) => ({ params: Promise.resolve({ name }) });

describe("태그 페이지 generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("글이 있는 태그는 색인을 허용한다", async () => {
    mocks.countPostsByTag.mockResolvedValue(3);

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params("java"));

    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  // 태그 이름은 임의 문자열이라, 존재 확인 없이 색인을 허용하면
  // 아무 값이나 넣은 URL 이 전부 색인 대상이 된다.
  it("글이 없는 태그는 색인을 막는다", async () => {
    mocks.countPostsByTag.mockResolvedValue(0);

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params("존재하지않는태그"));

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("조회가 실패해도 색인을 막는다", async () => {
    mocks.countPostsByTag.mockRejectedValue(new Error("db down"));

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params("오류"));

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
