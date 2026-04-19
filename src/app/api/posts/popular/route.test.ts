import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockLog = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/logger", () => ({ default: { child: vi.fn().mockReturnValue(mockLog) } }));

const mockGetPopularPostPathsOffset = vi.fn();
const mockGetPopularPostPathsTotal = vi.fn();
const mockGetPostsByPaths = vi.fn();

vi.mock("@/infra/db/repositories", () => ({
  getRepositories: vi.fn(() => ({
    post: { getPostsByPaths: mockGetPostsByPaths },
    visit: {
      getPopularPostPathsOffset: mockGetPopularPostPathsOffset,
      getPopularPostPathsTotal: mockGetPopularPostPathsTotal,
    },
  })),
}));

const makePostData = (path: string) => ({
  title: `Post ${path}`,
  path,
  slug: path.replace("/", "-"),
  category: "cat",
  subcategory: null,
  folders: [],
  description: "desc",
});

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/posts/popular");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

describe("GET /api/posts/popular", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPopularPostPathsTotal.mockResolvedValue(5);
    mockGetPopularPostPathsOffset.mockResolvedValue([]);
    mockGetPostsByPaths.mockResolvedValue([]);
  });

  it("200 응답 — items + hasMore + nextOffset 포함", async () => {
    mockGetPopularPostPathsOffset.mockResolvedValue([{ path: "/a", visitCount: 10 }]);
    mockGetPostsByPaths.mockResolvedValue([makePostData("/a")]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("hasMore");
    expect(body).toHaveProperty("nextOffset");
  });

  it("offset 적용 — getPopularPostPathsOffset에 offset 전달", async () => {
    const res = await GET(makeRequest({ offset: "20" }));
    expect(res.status).toBe(200);
    expect(mockGetPopularPostPathsOffset).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 20 })
    );
  });

  it("음수 offset → 400", async () => {
    const res = await GET(makeRequest({ offset: "-1" }));
    expect(res.status).toBe(400);
  });

  it("getPopularPostPathsOffset throw → 500 + logger 4-field", async () => {
    mockGetPopularPostPathsOffset.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    expect(mockLog.error).toHaveBeenCalledWith(
      expect.objectContaining({
        component: "api.posts.popular",
        operation: "GET",
        err: expect.any(Error),
      }),
      expect.any(String)
    );
  });

  it("reorder — paths 순서대로 정렬", async () => {
    mockGetPopularPostPathsOffset.mockResolvedValue([
      { path: "/b", visitCount: 20 },
      { path: "/a", visitCount: 10 },
    ]);
    mockGetPostsByPaths.mockResolvedValue([
      makePostData("/a"),
      makePostData("/b"),
    ]);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.items[0].path).toBe("/b");
    expect(body.items[1].path).toBe("/a");
  });

  it("hasMore — offset + popularPaths.length < total 이면 true (pathRows 기준)", async () => {
    mockGetPopularPostPathsTotal.mockResolvedValue(10);
    mockGetPopularPostPathsOffset.mockResolvedValue([{ path: "/a", visitCount: 5 }]);
    mockGetPostsByPaths.mockResolvedValue([makePostData("/a")]);
    const res = await GET(makeRequest({ limit: "1", offset: "0" }));
    const body = await res.json();
    expect(body.hasMore).toBe(true);
    expect(body.nextOffset).toBe(1);
  });

  it("nextOffset — 비활성 포스트로 items가 비어도 popularPaths.length 기준 증가", async () => {
    mockGetPopularPostPathsTotal.mockResolvedValue(10);
    mockGetPopularPostPathsOffset.mockResolvedValue([
      { path: "/inactive-a", visitCount: 5 },
      { path: "/inactive-b", visitCount: 4 },
    ]);
    mockGetPostsByPaths.mockResolvedValue([]); // 모두 비활성 → items 0
    const res = await GET(makeRequest({ limit: "2", offset: "5" }));
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.nextOffset).toBe(7); // 5 + 2 (popularPaths.length)
    expect(body.hasMore).toBe(true); // 7 < 10
  });
});
