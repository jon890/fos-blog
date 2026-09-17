// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  Material,
  MaterialState,
  StudyActionResult,
  StudyMaterialQuery,
} from "@/lib/study/contracts";
import { StudyLibrary } from "./StudyLibrary";

type MaterialPage = { items: Material[]; nextCursor: string | null };
type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function ok<T>(data: T): StudyActionResult<T> {
  return { status: "ok", data };
}

function failed<T>(): StudyActionResult<T> {
  return { status: "error", code: "failed", message: "학습자료 요청을 처리하지 못했습니다." };
}

function material(
  id: number,
  title = `자료 ${id}`,
  state: MaterialState = { starred: false, read: false, note: "", version: 0, updatedAt: null },
): Material {
  return {
    id,
    contentKey: `url:${id}`,
    canonicalUrl: `https://example.test/${id}`,
    title,
    publishedAt: null,
    excerpt: null,
    tags: [],
    kind: "page-link",
    sources: [{ sourceKey: "spring", sourceName: "Spring Blog", category: "techBlog" }],
    state,
    previouslyRecommended: false,
  };
}

function page(items: Material[], nextCursor: string | null = null): MaterialPage {
  return { items, nextCursor };
}

type Actions = {
  listMaterials: ReturnType<typeof vi.fn>;
  listSources: ReturnType<typeof vi.fn>;
  getMaterial: ReturnType<typeof vi.fn>;
  saveMaterialState: ReturnType<typeof vi.fn>;
};

function actions(overrides: Partial<Actions> = {}): Actions {
  return {
    listMaterials: vi.fn(async () => ok(page([]))),
    listSources: vi.fn(async () => ok([{ sourceKey: "spring", sourceName: "Spring Blog" }])),
    getMaterial: vi.fn(async () => ok(material(1))),
    saveMaterialState: vi.fn(async () => ok(material(1).state)),
    ...overrides,
  };
}

function renderLibrary(value: Actions) {
  return render(
    <StudyLibrary
      listMaterials={value.listMaterials as never}
      listSources={value.listSources as never}
      getMaterial={value.getMaterial as never}
      saveMaterialState={value.saveMaterialState as never}
    />,
  );
}

function queries(value: Actions): StudyMaterialQuery[] {
  return value.listMaterials.mock.calls.map(([query]) => query as StudyMaterialQuery);
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/admin/study");
  vi.restoreAllMocks();
});

describe("StudyLibrary", () => {
  it("URL query에서 필터를 복원하고 적용·뒤로 가기에 맞춰 목록을 다시 조회한다", async () => {
    window.history.replaceState(null, "", "/admin/study?q=initial&starred=true");
    const value = actions();
    renderLibrary(value);

    await waitFor(() => expect(queries(value).some((query) => query.q === "initial" && query.starred === true)).toBe(true));
    expect((screen.getByLabelText("검색") as HTMLInputElement).value).toBe("initial");

    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "changed" } });
    fireEvent.submit(screen.getByRole("button", { name: "필터 적용" }).closest("form")!);
    await waitFor(() => expect(window.location.search).toContain("q=changed"));

    window.history.replaceState(null, "", "/admin/study?q=restored&read=false");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => expect((screen.getByLabelText("검색") as HTMLInputElement).value).toBe("restored"));
    expect(queries(value).some((query) => query.q === "restored" && query.read === false)).toBe(true);
  });

  it("빠르게 바꾼 필터의 최신 응답만 표시하고 한국 날짜 끝을 다음 날 UTC 반열린 구간으로 보낸다", async () => {
    const first = deferred<StudyActionResult<MaterialPage>>();
    const latest = deferred<StudyActionResult<MaterialPage>>();
    const value = actions({
      listMaterials: vi.fn(async (query: StudyMaterialQuery) => {
        if (query.q === "old") return first.promise;
        if (query.q === "new") return latest.promise;
        return ok(page([]));
      }),
    });
    renderLibrary(value);
    await waitFor(() => expect(value.listSources).toHaveBeenCalled());
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("검색"));
    await user.type(screen.getByLabelText("검색"), "old");
    fireEvent.submit(screen.getByRole("button", { name: "필터 적용" }).closest("form")!);
    await user.clear(screen.getByLabelText("검색"));
    await user.type(screen.getByLabelText("검색"), "new");
    fireEvent.change(screen.getByLabelText("발행 시작"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("발행 끝"), { target: { value: "2026-09-02" } });
    fireEvent.submit(screen.getByRole("button", { name: "필터 적용" }).closest("form")!);

    latest.resolve(ok(page([material(2, "새 결과")])));
    await screen.findByText("새 결과");
    first.resolve(ok(page([material(1, "이전 결과")])));
    await waitFor(() => expect(screen.queryByText("이전 결과")).toBeNull());
    const latestQuery = queries(value).find((query) => query.q === "new");
    expect(latestQuery?.publishedFrom).toBe("2026-08-31T15:00:00.000Z");
    expect(latestQuery?.publishedTo).toBe("2026-09-02T15:00:00.000Z");
  });

  it("빈 목록, 검색 결과 없음과 조회 장애를 서로 다르게 안내한다", async () => {
    const value = actions();
    renderLibrary(value);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("아직 수집된 학습자료가 없습니다"));

    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "없는 검색" } });
    fireEvent.submit(screen.getByRole("button", { name: "필터 적용" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("조건에 맞는 자료가 없습니다"));

    value.listMaterials.mockImplementation(async () => failed<MaterialPage>());
    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("학습자료를 조회하지 못했습니다"));
  });

  it("세션 만료는 조회 장애와 구분해 재로그인을 안내한다", async () => {
    const value = actions({
      listMaterials: vi.fn(async () => ({
        status: "error" as const,
        code: "unauthenticated" as const,
        message: "로그인이 만료되었습니다.",
      })),
    });
    renderLibrary(value);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("로그인이 만료되었습니다"));
  });

  it("더 보기 실패 뒤 같은 cursor로 재시도하고 진행 중 새 유입을 기존 목록에 끼우지 않는다", async () => {
    let moreAttempts = 0;
    const value = actions({
      listMaterials: vi.fn(async (query: StudyMaterialQuery) => {
        if (query.cursor === "next-page") {
          moreAttempts += 1;
          return moreAttempts === 1 ? failed<MaterialPage>() : ok(page([material(2, "두 번째 자료")]));
        }
        return ok(page([material(1, "첫 번째 자료")], "next-page"));
      }),
    });
    renderLibrary(value);
    await screen.findByText("첫 번째 자료");
    await userEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(await screen.findByRole("button", { name: "더 보기 다시 시도" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "더 보기 다시 시도" }));
    await screen.findByText("두 번째 자료");
    expect(queries(value).filter((query) => query.cursor === "next-page")).toHaveLength(2);
  });

  it("409와 저장 응답 유실 뒤 최신 상태를 보여 주면서 메모 초안을 유지한다", async () => {
    let saveCount = 0;
    const latest = material(1, "자료", { starred: true, read: true, note: "다른 기기 메모", version: 4, updatedAt: null });
    const value = actions({
      listMaterials: vi.fn(async () => ok(page([material(1)]))),
      getMaterial: vi.fn(async () => ok(latest)),
      saveMaterialState: vi.fn(async () => {
        saveCount += 1;
        if (saveCount === 1) {
          return { status: "error" as const, code: "conflict" as const, message: "다른 곳에서 먼저 저장되었습니다." };
        }
        throw new TypeError("response lost");
      }),
    });
    renderLibrary(value);
    await screen.findByText("자료 1");
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "내 초안" } });
    await userEvent.click(screen.getByRole("button", { name: "상태와 메모 저장" }));
    expect((await screen.findByLabelText("최신 상태")).textContent).toContain("다른 기기 메모");
    expect((screen.getByLabelText("메모") as HTMLTextAreaElement).value).toBe("내 초안");
    await userEvent.click(screen.getByRole("button", { name: "상태와 메모 저장" }));
    await waitFor(() => expect(value.getMaterial).toHaveBeenCalledTimes(2));
    expect((screen.getByLabelText("메모") as HTMLTextAreaElement).value).toBe("내 초안");
  });

  it("저장 401은 저장 성공으로 표시하지 않고 재로그인을 안내한다", async () => {
    const value = actions({
      listMaterials: vi.fn(async () => ok(page([material(1)]))),
      saveMaterialState: vi.fn(async () => ({
        status: "error" as const,
        code: "unauthenticated" as const,
        message: "로그인이 만료되었습니다.",
      })),
    });
    renderLibrary(value);
    await screen.findByText("자료 1");
    await userEvent.click(screen.getByRole("button", { name: "상태와 메모 저장" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("로그인이 만료되었습니다"));
    expect(screen.getByRole("status").textContent).not.toContain("저장했습니다");
  });

  it("저장 성공의 전체 서버 상태를 목록에 반영한다", async () => {
    const savedState: MaterialState = { starred: true, read: true, note: "서버 메모", version: 1, updatedAt: "2026-09-01T00:00:00.000Z" };
    const value = actions({
      listMaterials: vi.fn(async () => ok(page([material(1)]))),
      saveMaterialState: vi.fn(async () => ok(savedState)),
    });
    renderLibrary(value);
    await screen.findByText("자료 1");
    const [starred, read] = screen.getAllByRole("checkbox");
    await userEvent.click(starred);
    await userEvent.click(read);
    await userEvent.click(screen.getByRole("button", { name: "상태와 메모 저장" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("저장했습니다"));
    expect(value.saveMaterialState).toHaveBeenCalledWith(1, { expectedVersion: 0, starred: true, read: true, note: "" });
    expect((screen.getByLabelText("메모") as HTMLTextAreaElement).value).toBe("서버 메모");
    expect((starred as HTMLInputElement).checked).toBe(true);
    expect((read as HTMLInputElement).checked).toBe(true);
  });

  it("브라우저에서 상대 API 경로를 호출하지 않는다", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      renderLibrary(actions());
      await screen.findByRole("status");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
