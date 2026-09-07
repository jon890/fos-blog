import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFolderContents: vi.fn(),
  getCrossCategoryPosts: vi.fn(),
  getAllPostPaths: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

vi.mock("@/infra/db/repositories", () => ({
  getRepositories: vi.fn(() => ({
    folder: { getFolderContents: mocks.getFolderContents },
    post: {
      getCrossCategoryPosts: mocks.getCrossCategoryPosts,
      getAllPostPaths: mocks.getAllPostPaths,
    },
  })),
}));

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_SITE_URL: "https://example.com" },
}));

vi.mock("@/lib/logger", () => ({
  default: {
    child: vi.fn().mockReturnValue({ warn: vi.fn() }),
  },
}));

vi.mock("@/lib/markdown", () => ({
  parseFrontMatter: vi.fn(),
  stripLeadingH1: vi.fn(),
}));

vi.mock("@/services", () => ({
  createGlossaryService: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/components/MarkdownRenderer", () => ({ MarkdownRenderer: vi.fn() }));
vi.mock("@/components/JsonLd", () => ({ BreadcrumbJsonLd: vi.fn() }));
vi.mock("@/components/Breadcrumb", () => ({ Breadcrumb: vi.fn() }));
vi.mock("@/components/CategoryDetailSubHero", () => ({
  CategoryDetailSubHero: vi.fn(),
}));
vi.mock("@/components/CategoriesSection", () => ({ CategoriesSection: vi.fn() }));
vi.mock("@/components/SubfolderCard", () => ({ SubfolderCard: vi.fn() }));
vi.mock("@/components/PostCard", () => ({ PostCard: vi.fn() }));
vi.mock("@/components/ReadmeFrame", () => ({ ReadmeFrame: vi.fn() }));

import { generateMetadata } from "./page";

const directPost = {
  title: "글",
  path: "AI/intro.md",
  slug: "intro.md",
  category: "AI",
  categories: ["AI"],
  subcategory: null,
  folders: ["AI"],
  description: null,
  thumbnailUrl: null,
};

const params = Promise.resolve({ path: ["AI"] });

describe("category generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFolderContents.mockResolvedValue({
      folders: [],
      posts: [],
      readme: null,
    });
    mocks.getCrossCategoryPosts.mockResolvedValue([]);
    mocks.getAllPostPaths.mockResolvedValue([]);
  });

  it("내용이 전혀 없으면 기존 noindex·nofollow를 유지한다", async () => {
    const metadata = await generateMetadata({ params });

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("교차 글만 있는 얇은 카테고리는 noindex·follow를 반환한다", async () => {
    mocks.getCrossCategoryPosts.mockResolvedValue([directPost]);

    const metadata = await generateMetadata({ params });

    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("README가 800바이트이면 색인 제한을 반환하지 않는다", async () => {
    mocks.getFolderContents.mockResolvedValue({
      folders: [],
      posts: [],
      readme: "a".repeat(800),
    });

    const metadata = await generateMetadata({ params });

    expect(metadata.robots).toBeUndefined();
  });

  it("직속 글이 5개이면 색인 제한을 반환하지 않는다", async () => {
    mocks.getFolderContents.mockResolvedValue({
      folders: [],
      posts: Array.from({ length: 5 }, (_, index) => ({
        ...directPost,
        path: `AI/post-${index}.md`,
      })),
      readme: null,
    });

    const metadata = await generateMetadata({ params });

    expect(metadata.robots).toBeUndefined();
  });
});
