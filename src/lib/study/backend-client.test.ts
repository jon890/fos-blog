import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { child: () => ({ warn, info: vi.fn(), error: vi.fn() }) },
}));

import {
  commitStudyImport,
  dryRunStudyImport,
  getStudyMaterial,
  getStudyRecommendationRun,
  listStudyMaterials,
  listStudyRecommendationRuns,
  listStudySources,
  studyBackendUrl,
  StudyBackendError,
  updateStudyMaterialState,
} from "./backend-client";

const BASE_URL = "https://backend.example.test";
const TOKEN = "admin-gateway-token-that-is-at-least-32-bytes";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function fetchReturning(response: Response | (() => Response)) {
  return vi.fn((_input: unknown, _init?: RequestInit) =>
    Promise.resolve(typeof response === "function" ? response() : response));
}

function options(fetchImpl: ReturnType<typeof fetchReturning>) {
  return { baseUrl: BASE_URL, token: TOKEN, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const state = { starred: false, read: false, note: "", version: 0, updatedAt: null };
const material = {
  id: 1,
  contentKey: "url:1",
  canonicalUrl: "https://example.test/1",
  title: "자료",
  publishedAt: null,
  excerpt: null,
  tags: [],
  kind: "page-link",
  sources: [],
  state,
  previouslyRecommended: false,
};

afterEach(() => vi.clearAllMocks());
beforeEach(() => warn.mockClear());

describe("학습자료 Backend client", () => {
  it("base URL 의 경로 접두사를 유지한 채 기존 상대 경로와 query 를 결합한다", () => {
    expect(studyBackendUrl(BASE_URL, "/materials")).toBe("https://backend.example.test/api/study/v1/materials");
    expect(studyBackendUrl(`${BASE_URL}/study/`, "/materials", new URLSearchParams({ limit: "30" })))
      .toBe("https://backend.example.test/study/api/study/v1/materials?limit=30");
    expect(studyBackendUrl(BASE_URL, "/recommendation-runs/report%2F1"))
      .toBe("https://backend.example.test/api/study/v1/recommendation-runs/report%2F1");
  });

  it("자료 목록 조건을 기존 query 이름으로 보내고 Bearer 로 인증한다", async () => {
    const fetchImpl = fetchReturning(json({ items: [material], nextCursor: null }));
    const result = await listStudyMaterials(
      { limit: 30, cursor: "next", q: "검색", starred: true, read: false, publishedFrom: "2026-09-01T00:00:00.000Z" },
      options(fetchImpl),
    );
    expect(result.items).toHaveLength(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("limit=30");
    expect(url).toContain("cursor=next");
    expect(url).toContain("starred=true");
    expect(url).toContain("read=false");
    expect(url).toContain("publishedFrom=2026-09-01T00%3A00%3A00.000Z");
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("소스 목록을 화면이 쓰는 이름으로 좁힌다", async () => {
    const fetchImpl = fetchReturning(json({
      sources: [{ sourceKey: "spring", title: "Spring Blog", category: "techBlog", url: "https://example.test", feedUrl: null, adapter: "page", enabled: true, version: 1 }],
    }));
    await expect(listStudySources(options(fetchImpl))).resolves.toEqual([
      { sourceKey: "spring", sourceName: "Spring Blog" },
    ]);
  });

  it("자료 단건과 상태 수정은 응답의 본문만 돌려준다", async () => {
    const detail = fetchReturning(json({ material }));
    await expect(getStudyMaterial(1, options(detail))).resolves.toEqual(material);

    const saved = fetchReturning(json({ state: { ...state, starred: true, version: 1 } }));
    await expect(updateStudyMaterialState(1, { expectedVersion: 0, starred: true }, options(saved)))
      .resolves.toMatchObject({ starred: true, version: 1 });
    const [, init] = saved.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ expectedVersion: 0, starred: true });
  });

  it("추천 목록과 상세, import dry-run 과 commit 을 기존 경로로 호출한다", async () => {
    const runs = fetchReturning(json({ items: [], nextCursor: null }));
    await listStudyRecommendationRuns({ limit: 30, cursor: null }, options(runs));
    expect(String(runs.mock.calls[0][0])).toBe("https://backend.example.test/api/study/v1/recommendation-runs?limit=30");

    const run = fetchReturning(json({ reportId: "report-2026", generatedAt: "2026-09-08T00:00:00.000Z", topics: [], publications: [] }));
    await getStudyRecommendationRun("report 2026", options(run));
    expect(String(run.mock.calls[0][0])).toBe("https://backend.example.test/api/study/v1/recommendation-runs/report%202026");

    const counts = { reports: 1, items: 1, newMaterials: 1, repeatedContentKeys: 0, existingReports: 0 };
    const dryRun = fetchReturning(json({ previewHash: "a".repeat(64), historyVersion: 4, counts, warnings: [] }));
    await dryRunStudyImport({ importKey: "legacy", reports: [] } as never, options(dryRun));
    expect(String(dryRun.mock.calls[0][0])).toBe("https://backend.example.test/api/study/v1/imports/dry-run");

    const commit = fetchReturning(json({ importKey: "legacy", counts, historyVersion: 5 }));
    await commitStudyImport({ importKey: "legacy", reports: [] } as never, options(commit));
    expect(String(commit.mock.calls[0][0])).toBe("https://backend.example.test/api/study/v1/imports/commit");
  });

  it.each([
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "VERSION_CONFLICT"],
    [413, "PAYLOAD_TOO_LARGE"],
    [429, "RATE_LIMITED"],
    [503, "UNAVAILABLE"],
  ])("Backend 의 %i 응답을 같은 오류 code 로 전달한다", async (status, code) => {
    const fetchImpl = fetchReturning(() => json({ error: { code, message: "실패", requestId: "request-1" } }, status));
    await expect(getStudyMaterial(1, options(fetchImpl))).rejects.toMatchObject({ status, code });
  });

  it("오류 envelope 가 없으면 상태 코드로 오류 code 를 정한다", async () => {
    const fetchImpl = fetchReturning(() => new Response("<html>502</html>", { status: 409 }));
    await expect(getStudyMaterial(1, options(fetchImpl))).rejects.toMatchObject({
      status: 409,
      code: "VERSION_CONFLICT",
    });
  });

  it("import 의 IMPORT_CHANGED 를 그대로 전달한다", async () => {
    const fetchImpl = fetchReturning(() => json({ error: { code: "IMPORT_CHANGED", message: "이력이 변경되었습니다.", requestId: "request-2" } }, 409));
    await expect(commitStudyImport({ importKey: "legacy", reports: [] } as never, options(fetchImpl)))
      .rejects.toMatchObject({ status: 409, code: "IMPORT_CHANGED" });
  });

  it("JSON 이 아닌 본문과 계약에 맞지 않는 응답을 503 으로 바꾼다", async () => {
    const broken = fetchReturning(() => new Response("not json", { status: 200 }));
    await expect(getStudyMaterial(1, options(broken))).rejects.toMatchObject({ status: 503, code: "UNAVAILABLE" });

    const mismatched = fetchReturning(() => json({ material: { id: 1 } }));
    await expect(getStudyMaterial(1, options(mismatched))).rejects.toMatchObject({ status: 503, code: "UNAVAILABLE" });
  });

  it("timeout 을 503 으로 바꾸고 응답을 기다리지 않는다", async () => {
    const hanging = vi.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    await expect(getStudyMaterial(1, {
      baseUrl: BASE_URL,
      token: TOKEN,
      timeoutMs: 10,
      fetchImpl: hanging as unknown as typeof fetch,
    })).rejects.toMatchObject({ status: 503, code: "UNAVAILABLE" });
  });

  it("설정이 없으면 Backend 를 호출하지 않고 503 을 돌려준다", async () => {
    const fetchImpl = fetchReturning(json({ material }));
    await expect(getStudyMaterial(1, { baseUrl: BASE_URL, fetchImpl: fetchImpl as unknown as typeof fetch }))
      .rejects.toBeInstanceOf(StudyBackendError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("로그와 오류 메시지에 token 과 요청 URL 을 남기지 않는다", async () => {
    const fetchImpl = fetchReturning(() => json({ error: { code: "FORBIDDEN", message: "권한이 없습니다.", requestId: "request-3" } }, 403));
    const error = await getStudyMaterial(1, options(fetchImpl)).catch((thrown: unknown) => thrown);
    const logged = JSON.stringify(warn.mock.calls);
    expect(warn).toHaveBeenCalled();
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain(BASE_URL);
    expect(String((error as Error).message)).not.toContain(TOKEN);
    expect(JSON.stringify(error)).not.toContain(TOKEN);
  });
});
