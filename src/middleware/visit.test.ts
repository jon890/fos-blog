import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest, NextFetchEvent } from "next/server";

// ── 호이스팅 모크 ────────────────────────────────────────────────────────────
const mockGetPostId = vi.hoisted(() => vi.fn());
const mockRecordVisit = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock("@/lib/logger", () => ({
  default: {
    child: vi.fn().mockReturnValue({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    }),
  },
}));

vi.mock("@/infra/db", () => ({
  getDb: vi.fn().mockReturnValue({}),
}));

vi.mock("@/infra/db/repositories/PostRepository", () => ({
  PostRepository: class {
    getPostId = mockGetPostId;
  },
}));

vi.mock("@/infra/db/repositories/VisitRepository", () => ({
  VisitRepository: class {
    recordVisit = mockRecordVisit;
  },
}));

// ── import (mock 등록 이후) ──────────────────────────────────────────────────
import { trackVisit } from "./visit";

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeRequest(pathname: string, ip?: string): NextRequest {
  return {
    nextUrl: { pathname },
    headers: {
      get: (key: string) => {
        if (key === "x-forwarded-for") return ip ?? "127.0.0.1";
        return null;
      },
    },
  } as unknown as NextRequest;
}

/** event.waitUntil 에 전달된 promise 를 캡처 */
function makeEvent(): {
  event: NextFetchEvent;
  getPromise: () => Promise<unknown>;
} {
  let captured: Promise<unknown> | null = null;
  const event = {
    waitUntil: (p: Promise<unknown>) => {
      captured = p;
    },
  } as unknown as NextFetchEvent;
  return {
    event,
    getPromise: () => captured ?? Promise.resolve(),
  };
}

// ── 테스트 ───────────────────────────────────────────────────────────────────

describe("trackVisit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks 가 resolvedValue 구현을 지우므로 재설정
    mockRecordVisit.mockResolvedValue(true);
  });

  it("/posts/latest → recordVisit 호출되지 않음 (SKIP_PATHS)", async () => {
    const { event, getPromise } = makeEvent();
    trackVisit(makeRequest("/posts/latest"), event);
    await getPromise();
    expect(mockRecordVisit).not.toHaveBeenCalled();
  });

  it("/posts/popular → recordVisit 호출되지 않음 (SKIP_PATHS)", async () => {
    const { event, getPromise } = makeEvent();
    trackVisit(makeRequest("/posts/popular"), event);
    await getPromise();
    expect(mockRecordVisit).not.toHaveBeenCalled();
  });

  it("pathname.length > 300 → waitUntil 호출 안 됨 (길이 가드)", async () => {
    const longPath = "/" + "a".repeat(301);
    const { event, getPromise } = makeEvent();
    trackVisit(makeRequest(longPath), event);
    await getPromise();
    expect(mockRecordVisit).not.toHaveBeenCalled();
  });

  it("/ → recordVisit('/', ipHash) 호출", async () => {
    const { event, getPromise } = makeEvent();
    trackVisit(makeRequest("/", "10.0.0.1"), event);
    await getPromise();
    expect(mockRecordVisit).toHaveBeenCalledOnce();
    const [calledPath] = mockRecordVisit.mock.calls[0];
    expect(calledPath).toBe("/");
  });

  it("/posts/abc.md + getPostId returns null → recordVisit 호출되지 않음", async () => {
    mockGetPostId.mockResolvedValueOnce(null);
    const { event, getPromise } = makeEvent();
    trackVisit(makeRequest("/posts/abc.md"), event);
    await getPromise();
    expect(mockGetPostId).toHaveBeenCalledWith("abc.md");
    expect(mockRecordVisit).not.toHaveBeenCalled();
  });

  it("/posts/abc.md + getPostId returns number → recordVisit('abc.md', ipHash) 호출", async () => {
    mockGetPostId.mockResolvedValueOnce(42);
    const { event, getPromise } = makeEvent();
    trackVisit(makeRequest("/posts/abc.md", "192.168.0.1"), event);
    await getPromise();
    expect(mockGetPostId).toHaveBeenCalledWith("abc.md");
    expect(mockRecordVisit).toHaveBeenCalledOnce();
    const [calledPath, calledHash] = mockRecordVisit.mock.calls[0];
    expect(calledPath).toBe("abc.md");
    expect(typeof calledHash).toBe("string");
    expect(calledHash).toHaveLength(64); // sha256 hex
  });

  it("/foo (matcher 외 경로) → recordVisit 호출되지 않음", async () => {
    const { event, getPromise } = makeEvent();
    trackVisit(makeRequest("/foo"), event);
    await getPromise();
    expect(mockRecordVisit).not.toHaveBeenCalled();
  });
});
