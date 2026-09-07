import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPost: vi.fn(),
}));

// vitest node 환경에서 server-only 가드 우회
vi.mock("server-only", () => ({}));

vi.mock("@/infra/db/repositories", () => ({
  getRepositories: vi.fn(() => ({
    post: { getPost: mocks.getPost },
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

  // 조회 실패는 "없는 글"과 다르게 다뤄야 한다.
  // 이 catch 는 파싱·추출까지 덮으므로, DB 가 잠깐 흔들리는 동안
  // 살아 있는 글에 noindex 를 붙이면 프리렌더 캐시에 그대로 굳는다.
  it("조회가 실패하면 색인 여부를 단언하지 않는다", async () => {
    mocks.getPost.mockRejectedValue(new Error("db down"));

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params(["오류.md"]));

    expect(metadata.robots).toBeUndefined();
  });

  it("정상 글에는 robots 를 붙이지 않는다", async () => {
    mocks.getPost.mockResolvedValue({
      content: "# 제목\n\n본문이다.",
      post: { title: "제목", createdAt: null, updatedAt: null, thumbnailUrl: null },
    });

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params(["정상글.md"]));

    expect(metadata.robots).toBeUndefined();
  });

  // frontmatter 로 색인을 끈 글은 follow 를 유지해야 한다 (ADR-005).
  it("frontMatter.index === false 는 follow 를 유지한다", async () => {
    mocks.getPost.mockResolvedValue({
      content: "---\nindex: false\n---\n\n# 제목\n\n본문이다.",
      post: { title: "제목", createdAt: null, updatedAt: null, thumbnailUrl: null },
    });

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params(["숨긴글.md"]));

    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
