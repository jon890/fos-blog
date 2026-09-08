// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudyLibrary } from "./StudyLibrary";

type Deferred = { promise: Promise<Response>; resolve: (response: Response) => void };

function deferred(): Deferred {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function sourceResponse(): Response {
  return json({ sources: [{ sourceKey: "spring", title: "Spring Blog", category: "techBlog", url: "https://example.test", feedUrl: null, adapter: "page", enabled: true, version: 1 }] });
}

function material(id: number, title = `자료 ${id}`, state = { starred: false, read: false, note: "", version: 0, updatedAt: null }) {
  return { id, contentKey: `url:${id}`, canonicalUrl: `https://example.test/${id}`, title, publishedAt: null, excerpt: null, tags: [], kind: "page-link", sources: [{ sourceKey: "spring", sourceName: "Spring Blog", category: "techBlog" }], state, previouslyRecommended: false };
}

function list(items: ReturnType<typeof material>[], nextCursor: string | null = null): Response {
  return json({ items, nextCursor });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("StudyLibrary", () => {
  it("빠르게 바꾼 필터의 최신 응답만 표시하고 한국 날짜 끝을 다음 날 UTC 반열린 구간으로 보낸다", async () => {
    const first = deferred();
    const latest = deferred();
    const fetchMock = vi.fn((input: string) => {
      if (input === "/api/study/v1/sources") return Promise.resolve(sourceResponse());
      if (input.includes("q=old")) return first.promise;
      if (input.includes("q=new")) return latest.promise;
      return Promise.resolve(list([]));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<StudyLibrary />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/study/v1/sources"));
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("검색"));
    await user.type(screen.getByLabelText("검색"), "old");
    fireEvent.submit(screen.getByRole("button", { name: "필터 적용" }).closest("form")!);
    await user.clear(screen.getByLabelText("검색"));
    await user.type(screen.getByLabelText("검색"), "new");
    fireEvent.change(screen.getByLabelText("발행 시작"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("발행 끝"), { target: { value: "2026-09-02" } });
    fireEvent.submit(screen.getByRole("button", { name: "필터 적용" }).closest("form")!);

    latest.resolve(list([material(2, "새 결과")]));
    await screen.findByText("새 결과");
    first.resolve(list([material(1, "이전 결과")]));
    await waitFor(() => expect(screen.queryByText("이전 결과")).toBeNull());
    const latestUrl = fetchMock.mock.calls.map(([input]) => String(input)).find((input) => input.includes("q=new"));
    expect(latestUrl).toContain("publishedFrom=2026-08-31T15%3A00%3A00.000Z");
    expect(latestUrl).toContain("publishedTo=2026-09-02T15%3A00%3A00.000Z");
  });

  it("빈 목록, 검색 결과 없음과 조회 장애를 서로 다르게 안내한다", async () => {
    const fetchMock = vi.fn((input: string) => input === "/api/study/v1/sources" ? Promise.resolve(sourceResponse()) : Promise.resolve(list([])));
    vi.stubGlobal("fetch", fetchMock);
    render(<StudyLibrary />);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("아직 수집된 학습자료가 없습니다"));

    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "없는 검색" } });
    fireEvent.submit(screen.getByRole("button", { name: "필터 적용" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("조건에 맞는 자료가 없습니다"));

    fetchMock.mockImplementation((input: string) => input === "/api/study/v1/sources" ? Promise.resolve(sourceResponse()) : Promise.resolve(json({ error: {} }, 503)));
    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("학습자료를 조회하지 못했습니다"));
  });

  it("더 보기 실패 뒤 같은 cursor로 재시도하고 진행 중 새 유입을 기존 목록에 끼우지 않는다", async () => {
    const urls: string[] = [];
    let moreAttempts = 0;
    const fetchMock = vi.fn((input: string) => {
      if (input === "/api/study/v1/sources") return Promise.resolve(sourceResponse());
      urls.push(input);
      if (input.includes("cursor=next-page")) {
        moreAttempts += 1;
        return moreAttempts === 1 ? Promise.resolve(json({ error: {} }, 503)) : Promise.resolve(list([material(2, "두 번째 자료")]));
      }
      return Promise.resolve(list([material(1, "첫 번째 자료")], "next-page"));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<StudyLibrary />);
    await screen.findByText("첫 번째 자료");
    await userEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(await screen.findByRole("button", { name: "더 보기 다시 시도" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "더 보기 다시 시도" }));
    await screen.findByText("두 번째 자료");
    expect(urls.filter((url) => url.includes("cursor=next-page"))).toHaveLength(2);
  });

  it("409와 PATCH 응답 유실 뒤 최신 상태를 보여 주면서 메모 초안을 유지한다", async () => {
    let saveCount = 0;
    const latest = material(1, "자료", { starred: true, read: true, note: "다른 기기 메모", version: 4, updatedAt: null });
    const fetchMock = vi.fn((input: string, init?: RequestInit) => {
      if (input === "/api/study/v1/sources") return Promise.resolve(sourceResponse());
      if (input.startsWith("/api/study/v1/materials?")) return Promise.resolve(list([material(1)]));
      if (input === "/api/study/v1/materials/1" && !init) return Promise.resolve(json({ material: latest }));
      if (input === "/api/study/v1/materials/1/state") {
        saveCount += 1;
        return saveCount === 1 ? Promise.resolve(json({ error: {} }, 409)) : Promise.reject(new TypeError("response lost"));
      }
      throw new Error(`unexpected ${input}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<StudyLibrary />);
    await screen.findByText("자료 1");
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "내 초안" } });
    await userEvent.click(screen.getByRole("button", { name: "상태와 메모 저장" }));
    expect((await screen.findByLabelText("최신 상태")).textContent).toContain("다른 기기 메모");
    expect((screen.getByLabelText("메모") as HTMLTextAreaElement).value).toBe("내 초안");
    await userEvent.click(screen.getByRole("button", { name: "상태와 메모 저장" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => input === "/api/study/v1/materials/1")).toHaveLength(2));
    expect((screen.getByLabelText("메모") as HTMLTextAreaElement).value).toBe("내 초안");
  });

  it("PATCH 401은 저장 성공으로 표시하지 않고 재로그인을 안내한다", async () => {
    const fetchMock = vi.fn((input: string) => {
      if (input === "/api/study/v1/sources") return Promise.resolve(sourceResponse());
      if (input.startsWith("/api/study/v1/materials?")) return Promise.resolve(list([material(1)]));
      if (input === "/api/study/v1/materials/1/state") return Promise.resolve(json({ error: {} }, 401));
      throw new Error(`unexpected ${input}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<StudyLibrary />);
    await screen.findByText("자료 1");
    await userEvent.click(screen.getByRole("button", { name: "상태와 메모 저장" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("로그인이 만료되었습니다"));
    expect(screen.getByRole("status").textContent).not.toContain("저장했습니다");
  });

  it("PATCH 성공의 전체 서버 상태를 목록에 반영한다", async () => {
    const savedState = { starred: true, read: true, note: "서버 메모", version: 1, updatedAt: "2026-09-01T00:00:00.000Z" };
    const fetchMock = vi.fn((input: string) => {
      if (input === "/api/study/v1/sources") return Promise.resolve(sourceResponse());
      if (input.startsWith("/api/study/v1/materials?")) return Promise.resolve(list([material(1)]));
      if (input === "/api/study/v1/materials/1/state") return Promise.resolve(json({ state: savedState }));
      throw new Error(`unexpected ${input}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<StudyLibrary />);
    await screen.findByText("자료 1");
    await userEvent.click(document.querySelector<HTMLInputElement>("#material-starred")!);
    await userEvent.click(document.querySelector<HTMLInputElement>("#material-read")!);
    await userEvent.click(screen.getByRole("button", { name: "상태와 메모 저장" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("저장했습니다"));
    expect((screen.getByLabelText("메모") as HTMLTextAreaElement).value).toBe("서버 메모");
    expect(document.querySelector<HTMLInputElement>("#material-starred")!.checked).toBe(true);
    expect(document.querySelector<HTMLInputElement>("#material-read")!.checked).toBe(true);
  });
});
