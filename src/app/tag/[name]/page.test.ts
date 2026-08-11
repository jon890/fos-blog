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

vi.mock("@/lib/logger", () => ({
  default: { child: vi.fn().mockReturnValue({ warn: vi.fn() }) },
}));

const params = (name: string) => ({ params: Promise.resolve({ name }) });

describe("태그 페이지 generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("글이 있는 태그는 색인을 막지 않는다", async () => {
    mocks.countPostsByTag.mockResolvedValue(3);

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params("java"));

    expect(metadata.robots).toBeUndefined();
  });

  // 태그 이름은 임의 문자열이라, 존재 확인 없이 색인을 허용하면
  // 아무 값이나 넣은 URL 이 전부 색인 대상이 된다.
  it("글이 없는 태그는 색인을 막는다", async () => {
    mocks.countPostsByTag.mockResolvedValue(0);

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params("존재하지않는태그"));

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  // 글이 있는 태그가 DB 장애로 색인에서 빠지는 편이 더 나쁘다.
  it("조회가 실패하면 색인 여부를 단언하지 않는다", async () => {
    mocks.countPostsByTag.mockRejectedValue(new Error("db down"));

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params("오류"));

    expect(metadata.robots).toBeUndefined();
  });
});
