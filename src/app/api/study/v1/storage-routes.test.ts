import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createTestDatabase, getTestDatabaseUrl, migrateTestDatabase } from "@/infra/db/test-utils";
import { StudyRepository } from "@/infra/db/repositories/StudyRepository";
import {
  studyMaterialSources,
  studyMaterialStates,
  studyMaterialTags,
  studyMaterials,
  studyRequestReceipts,
  studySourceCursors,
  studySources,
} from "@/infra/db/schema";
import { StudyAuthError, authorizeStudyRequest } from "@/lib/study/auth";
import { GET as listSources } from "./sources/route";
import { PUT as putSource } from "./sources/[sourceKey]/route";
import { GET as getCursor } from "./sources/[sourceKey]/cursor/route";
import { GET as listMaterials } from "./materials/route";
import { GET as getMaterial } from "./materials/[id]/route";
import { PATCH as patchState } from "./materials/[id]/state/route";
import { POST as ingest, GET as invalidIngestionMethod } from "./ingestions/route";

const repositoryState = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock("@/infra/db/repositories", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/infra/db/repositories")>(),
  getRepositories: () => ({ study: repositoryState.value }),
}));
vi.mock("@/lib/study/auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/study/auth")>(),
  authorizeStudyRequest: vi.fn(),
}));

const origin = "https://blog.example.test";
const serviceHeaders = { authorization: "Bearer fixture", "content-type": "application/json" };
const sourceContext = (sourceKey: string) => ({ params: Promise.resolve({ sourceKey }) });
const idContext = (id: string) => ({ params: Promise.resolve({ id }) });
const jsonRequest = (path: string, method: string, body: unknown, headers: HeadersInit = serviceHeaders) =>
  new Request(`${origin}/api/study/v1/${path}`, { method, headers, body: JSON.stringify(body) });

describe("학습자료 Route 권한과 HTTP 계약", () => {
  beforeEach(() => {
    vi.mocked(authorizeStudyRequest).mockResolvedValue({ kind: "service" });
  });

  it("미지원 메서드는 405와 Allow를 반환한다", async () => {
    const response = invalidIngestionMethod();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("인증 오류를 리디렉션하지 않고 JSON으로 반환한다", async () => {
    vi.mocked(authorizeStudyRequest).mockRejectedValueOnce(
      new StudyAuthError(401, "UNAUTHENTICATED", "인증이 필요합니다."),
    );
    const response = await listMaterials(new Request(`${origin}/api/study/v1/materials`));
    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });

  it("unknown query와 잘못된 본문을 400으로 거절한다", async () => {
    expect((await listMaterials(new Request(`${origin}/api/study/v1/materials?unknown=1`))).status).toBe(400);
    const sourceQuery = await listSources(new Request(`${origin}/api/study/v1/sources?unknown=1`));
    expect(sourceQuery.status).toBe(400);
    expect(await sourceQuery.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
    const response = await putSource(jsonRequest("sources/source", "PUT", {
      title: "소스", category: "techBlog", url: "https://example.test", feedUrl: null,
      adapter: "page", enabled: true, expectedVersion: 0, unknown: true,
    }), sourceContext("source"));
    expect(response.status).toBe(400);
  });
});

describe.skipIf(!getTestDatabaseUrl())("학습자료 Route 실제 MySQL 흐름", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
  const sourceKey = "route-source";
  const contentKey = "url:e6b7ccaedbf110b1f23a0b27cd070f456bd08ebec74b536a9fb550da3fafdef6";

  beforeAll(async () => {
    fixture = await createTestDatabase();
    await migrateTestDatabase(fixture);
    repositoryState.value = new StudyRepository(fixture.db);
  });

  beforeEach(async () => {
    vi.mocked(authorizeStudyRequest).mockResolvedValue({ kind: "service" });
    const ids = await fixture.db.select({ id: studyMaterials.id }).from(studyMaterials)
      .where(eq(studyMaterials.contentKey, contentKey));
    if (ids.length) {
      const materialIds = ids.map(({ id }) => id);
      await fixture.db.delete(studyMaterialStates).where(inArray(studyMaterialStates.materialId, materialIds));
      await fixture.db.delete(studyMaterialTags).where(inArray(studyMaterialTags.materialId, materialIds));
      await fixture.db.delete(studyMaterialSources).where(inArray(studyMaterialSources.materialId, materialIds));
      await fixture.db.delete(studyMaterials).where(inArray(studyMaterials.id, materialIds));
    }
    await fixture.db.delete(studyRequestReceipts).where(eq(studyRequestReceipts.requestKey, "route-ingestion"));
    await fixture.db.delete(studySourceCursors).where(eq(studySourceCursors.sourceKey, sourceKey));
    await fixture.db.delete(studySources).where(eq(studySources.sourceKey, sourceKey));
  });

  afterAll(async () => {
    if (!fixture) return;
    await fixture.connection.end();
  });

  it("소스 등록부터 cursor 조회·수집·영수증 재조회와 자료 상태까지 연결한다", async () => {
    const sourceResponse = await putSource(jsonRequest(`sources/${sourceKey}`, "PUT", {
      title: "Route source", category: "techBlog", url: "https://example.test", feedUrl: null,
      adapter: "page", enabled: true, expectedVersion: 0,
    }), sourceContext(sourceKey));
    expect(sourceResponse.status).toBe(200);

    const sourcesResponse = await listSources(new Request(`${origin}/api/study/v1/sources`, { headers: serviceHeaders }));
    expect((await sourcesResponse.json()).sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKey, version: 1 }),
    ]));

    const cursorResponse = await getCursor(
      new Request(`${origin}/api/study/v1/sources/${sourceKey}/cursor?mode=recent`, { headers: serviceHeaders }),
      sourceContext(sourceKey),
    );
    expect(await cursorResponse.json()).toEqual({ sourceKey, mode: "recent", cursor: null, version: 0 });

    const ingestionBody = {
      sourceKey, mode: "recent", expectedCursorVersion: 0, idempotencyKey: "route-ingestion",
      cursor: { next: "page-2" },
      items: [{
        contentKey,
        canonicalUrl: "https://example.test/article",
        url: "https://example.test/article",
        title: "Route material", published: "2026-09-08", publishedAt: "2026-09-08T00:00:00.000Z",
        excerpt: "요약", kind: "page-link", tags: ["route"], collectedAt: "2026-09-08T01:00:00.000Z",
      }],
    };
    const first = await ingest(jsonRequest("ingestions", "POST", ingestionBody));
    const repeated = await ingest(jsonRequest("ingestions", "POST", ingestionBody));
    expect(await first.json()).toEqual({ idempotencyKey: "route-ingestion", acceptedCount: 1, cursorVersion: 1 });
    expect(await repeated.json()).toEqual({ idempotencyKey: "route-ingestion", acceptedCount: 1, cursorVersion: 1 });

    vi.mocked(authorizeStudyRequest).mockResolvedValue({ kind: "admin", ownerKey: "owner" });
    const materialsResponse = await listMaterials(new Request(`${origin}/api/study/v1/materials`));
    const materialsBody = await materialsResponse.json();
    const material = materialsBody.items.find((item: { contentKey: string }) => item.contentKey === contentKey);
    expect(material).toMatchObject({ title: "Route material", state: { version: 0 } });

    const detail = await getMaterial(
      new Request(`${origin}/api/study/v1/materials/${material.id}`),
      idContext(String(material.id)),
    );
    expect((await detail.json()).material.id).toBe(material.id);
    const state = await patchState(jsonRequest(
      `materials/${material.id}/state`, "PATCH", { expectedVersion: 0, starred: true },
      { origin, "content-type": "application/json" },
    ), idContext(String(material.id)));
    expect(await state.json()).toMatchObject({ state: { starred: true, version: 1 } });
  });
});
