import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPost: vi.fn(),
}));

// vitest node 환경에서 server-only 가드 우회
vi.mock("server-only", () => ({}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

vi.mock("@/infra/db/repositories", () => ({
  getRepositories: vi.fn(() => ({
    post: { getPost: mocks.getPost },
    visit: {},
  })),
}));

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_SITE_URL: "https://example.com" },
}));

vi.mock("@/lib/logger", () => ({
  default: { child: vi.fn().mockReturnValue({ warn: vi.fn(), error: vi.fn() }) },
}));

const params = (slug: string[]) => ({ params: Promise.resolve({ slug }) });

describe("글 상세 generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 빌드 시점에 정적 생성된 경로는 글이 삭제된 뒤에도 캐시가 200 으로 남는다.
  // 상태 코드로 알릴 수 없으므로 메타데이터가 색인을 막아야 한다.
  // 막지 않으면 본문이 제목 한 줄뿐인 페이지가 색인 대상으로 남는다.
  it("글이 없으면 색인을 막는다", async () => {
    mocks.getPost.mockResolvedValue(null);

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params(["없는글.md"]));

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("조회가 실패해도 색인을 막는다", async () => {
    mocks.getPost.mockRejectedValue(new Error("db down"));

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params(["오류.md"]));

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
