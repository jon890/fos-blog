import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockLog = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/logger", () => ({ default: { child: vi.fn().mockReturnValue(mockLog) } }));

const mockGetRecentPostsCursor = vi.fn();
const mockGetPostVisitCounts = vi.fn();

vi.mock("@/infra/db/repositories", () => ({
  getRepositories: vi.fn(() => ({
    post: { getRecentPostsCursor: mockGetRecentPostsCursor },
    visit: { getPostVisitCounts: mockGetPostVisitCounts },
  })),
}));

const now = new Date("2024-01-10T00:00:00.000Z");

const makeRow = (id: number) => ({
  title: `Post ${id}`,
  path: `/posts/post-${id}`,
  slug: `post-${id}`,
  category: "cat",
  subcategory: null,
  folders: [],
  description: "desc",
  updatedAt: now,
  id,
});

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/posts/latest");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

describe("GET /api/posts/latest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPostVisitCounts.mockResolvedValue({});
  });

  it("200 응답 — items + nextCursor 포함", async () => {
    mockGetRecentPostsCursor.mockResolvedValue([makeRow(1)]);
    const res = await GET(makeRequest({ limit: "1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("nextCursor");
  });

  it("cursor 미지정 시 첫 페이지 — nextCursor null (items < limit)", async () => {
    mockGetRecentPostsCursor.mockResolvedValue([makeRow(1)]);
    const res = await GET(makeRequest({ limit: "10" }));
    const body = await res.json();
    expect(body.nextCursor).toBeNull();
  });

  it("cursor 지정 시 파싱 후 repo에 전달", async () => {
    mockGetRecentPostsCursor.mockResolvedValue([]);
    const cursor = `${now.toISOString()}:42`;
    await GET(makeRequest({ cursor }));
    expect(mockGetRecentPostsCursor).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { updatedAt: now, id: 42 } })
    );
  });

  it("cursor 파싱 실패 시 400", async () => {
    const res = await GET(makeRequest({ cursor: "invalid-cursor" }));
    expect(res.status).toBe(400);
  });

  it("repo throw → 500 + logger 4-field 호출", async () => {
    mockGetRecentPostsCursor.mockRejectedValue(new Error("DB down"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    expect(mockLog.error).toHaveBeenCalledWith(
      expect.objectContaining({
        component: "api.posts.latest",
        operation: "GET",
        err: expect.any(Error),
      }),
      expect.any(String)
    );
  });

  it("items 응답에 updatedAt/id 필드 없음", async () => {
    mockGetRecentPostsCursor.mockResolvedValue([makeRow(1)]);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.items[0]).not.toHaveProperty("updatedAt");
    expect(body.items[0]).not.toHaveProperty("id");
  });
});
