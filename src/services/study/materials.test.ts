import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { StudyRepository } from "@/infra/db/repositories";
import { createTestDatabase, migrateTestDatabase } from "@/infra/db/test-utils";
import {
  studyMaterialSources,
  studyMaterialStates,
  studyMaterialTags,
  studyMaterials,
  studyRecommendationRuns,
  studyRecommendedMaterials,
  studySources,
} from "@/infra/db/schema";
import { getMaterial, listMaterials, updateMaterialState } from "./materials";

const sourceKeys = ["p02-material-source-a", "p02-material-source-b"];
const contentKeys = [
  "p02:percent",
  "p02:underscore",
  "p02:backslash",
  "p02:null-date",
  "p02:range-start",
  "p02:range-end",
  "p02:keyset-new",
];
const recommendationReportId = "p02-recommendation-run";
const now = new Date("2026-09-08T04:05:06.789Z");

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("자료 서비스 MySQL", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
  let concurrentFixture: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
  let repository: StudyRepository;
  let concurrentRepository: StudyRepository;
  const materialIds = new Map<string, number>();

  async function cleanup(): Promise<void> {
    if (!fixture) return;
    const materials = await fixture.db
      .select({ id: studyMaterials.id })
      .from(studyMaterials)
      .where(inArray(studyMaterials.contentKey, contentKeys));
    const ids = materials.map(({ id }) => id);
    if (ids.length > 0) {
      await fixture.db.delete(studyRecommendedMaterials).where(inArray(studyRecommendedMaterials.materialId, ids));
      await fixture.db.delete(studyMaterialStates).where(inArray(studyMaterialStates.materialId, ids));
      await fixture.db.delete(studyMaterialTags).where(inArray(studyMaterialTags.materialId, ids));
      await fixture.db.delete(studyMaterialSources).where(inArray(studyMaterialSources.materialId, ids));
    }
    await fixture.db
      .delete(studyRecommendationRuns)
      .where(eq(studyRecommendationRuns.reportId, recommendationReportId));
    if (ids.length > 0) await fixture.db.delete(studyMaterials).where(inArray(studyMaterials.id, ids));
    await fixture.db.delete(studySources).where(inArray(studySources.sourceKey, sourceKeys));
    materialIds.clear();
  }

  async function seed(): Promise<void> {
    const activeFixture = fixture!;
    await activeFixture.db.insert(studySources).values([
      {
        sourceKey: sourceKeys[0], title: "Primary source", category: "techBlog",
        url: "https://example.com/primary", feedUrl: null, adapter: "page", enabled: true,
        version: 1, updatedAt: now,
      },
      {
        sourceKey: sourceKeys[1], title: "Secondary source", category: "ai",
        url: "https://example.com/secondary", feedUrl: null, adapter: "page", enabled: true,
        version: 1, updatedAt: now,
      },
    ]);
    const materials = [
      { contentKey: contentKeys[0], title: "Percent 100% guide", excerpt: "literal percent", publishedAt: new Date("2026-09-07T00:00:00Z") },
      { contentKey: contentKeys[1], title: "Under_score guide", excerpt: "literal underscore", publishedAt: new Date("2026-09-07T01:00:00Z") },
      { contentKey: contentKeys[2], title: String.raw`Back\slash guide`, excerpt: "literal backslash", publishedAt: new Date("2026-09-07T02:00:00Z") },
      { contentKey: contentKeys[3], title: "Unknown publication date", excerpt: null, publishedAt: null },
      { contentKey: contentKeys[4], title: "Range start", excerpt: null, publishedAt: new Date("2026-09-08T00:00:00Z") },
      { contentKey: contentKeys[5], title: "Range end", excerpt: null, publishedAt: new Date("2026-09-09T00:00:00Z") },
    ];
    await activeFixture.db.insert(studyMaterials).values(materials.map((material, index) => ({
      ...material,
      canonicalUrl: `https://example.com/material/${index}`,
      url: `https://example.com/material/${index}`,
      published: material.publishedAt?.toISOString() ?? "",
      kind: "page-link",
      collectedAt: now,
      createdAt: now,
    })));
    const rows = await activeFixture.db
      .select({ id: studyMaterials.id, contentKey: studyMaterials.contentKey })
      .from(studyMaterials)
      .where(inArray(studyMaterials.contentKey, contentKeys.slice(0, 6)));
    for (const row of rows) materialIds.set(row.contentKey, row.id);
    await activeFixture.db.insert(studyMaterialSources).values([
      ...rows.map(({ id }) => ({ materialId: id, sourceKey: sourceKeys[0], collectedAt: now })),
      { materialId: materialIds.get(contentKeys[0])!, sourceKey: sourceKeys[1], collectedAt: now },
    ]);
    await activeFixture.db.insert(studyMaterialTags).values([
      { materialId: materialIds.get(contentKeys[0])!, tag: "backend" },
      { materialId: materialIds.get(contentKeys[0])!, tag: "testing" },
    ]);
    await activeFixture.db.insert(studyMaterialStates).values({
      ownerKey: "owner", materialId: materialIds.get(contentKeys[2])!, starred: true,
      read: false, note: "기존 메모", version: 1, updatedAt: now,
    });
    await activeFixture.db.insert(studyRecommendationRuns).values({
      reportId: recommendationReportId,
      generatedAt: now,
      committedAt: now,
      requestHash: "c".repeat(64),
      historyVersion: 1,
      origin: "live",
    });
    const [run] = await activeFixture.db
      .select({ id: studyRecommendationRuns.id })
      .from(studyRecommendationRuns)
      .where(eq(studyRecommendationRuns.reportId, recommendationReportId));
    await activeFixture.db.insert(studyRecommendedMaterials).values({
      ownerKey: "owner",
      materialId: materialIds.get(contentKeys[1])!,
      firstRunId: run.id,
    });
  }

  beforeAll(async () => {
    fixture = await createTestDatabase();
    await migrateTestDatabase(fixture);
    concurrentFixture = await createTestDatabase();
    repository = new StudyRepository(fixture.db);
    concurrentRepository = new StudyRepository(concurrentFixture.db);
  }, 30_000);

  beforeEach(async () => {
    await cleanup();
    await seed();
  });

  afterEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    if (!fixture) return;
    try {
      await cleanup();
    } finally {
      await fixture.connection.end();
      await concurrentFixture?.connection.end();
    }
  });

  it("LIKE 특수문자를 리터럴로 검색한다", async () => {
    const percent = await listMaterials({ sourceKey: sourceKeys[0], q: "%" }, repository);
    const underscore = await listMaterials({ sourceKey: sourceKeys[0], q: "_" }, repository);
    const backslash = await listMaterials({ sourceKey: sourceKeys[0], q: "\\" }, repository);
    expect(percent.items.map(({ contentKey }) => contentKey)).toEqual([contentKeys[0]]);
    expect(underscore.items.map(({ contentKey }) => contentKey)).toEqual([contentKeys[1]]);
    expect(backslash.items.map(({ contentKey }) => contentKey)).toEqual([contentKeys[2]]);
  });

  it("소스 다중 연결과 태그를 묶어서 읽고 미생성 상태와 null 날짜를 구분한다", async () => {
    const multiple = await getMaterial(materialIds.get(contentKeys[0])!, repository);
    expect(multiple.material.sources).toEqual([
      { sourceKey: sourceKeys[0], sourceName: "Primary source", category: "techBlog" },
      { sourceKey: sourceKeys[1], sourceName: "Secondary source", category: "ai" },
    ]);
    expect(multiple.material.tags).toEqual(["backend", "testing"]);

    const withoutState = await getMaterial(materialIds.get(contentKeys[3])!, repository);
    expect(withoutState.material).toMatchObject({
      publishedAt: null,
      state: { starred: false, read: false, note: "", version: 0, updatedAt: null },
      previouslyRecommended: false,
    });
  });

  it("날짜 범위를 반열림으로 적용하고 null 발행일을 제외한다", async () => {
    const page = await listMaterials({
      sourceKey: sourceKeys[0],
      publishedFrom: "2026-09-08T00:00:00.000Z",
      publishedTo: "2026-09-09T00:00:00.000Z",
    }, repository);
    expect(page.items.map(({ contentKey }) => contentKey)).toEqual([contentKeys[4]]);
  });

  it("첫 최대 ID를 cursor에 고정하고 다른 필터의 cursor를 거절한다", async () => {
    const first = await listMaterials({ sourceKey: sourceKeys[0], limit: 2 }, repository);
    expect(first.nextCursor).not.toBeNull();
    await fixture!.db.insert(studyMaterials).values({
      contentKey: contentKeys[6], canonicalUrl: "https://example.com/material/new",
      url: "https://example.com/material/new", title: "Inserted during paging", published: "",
      publishedAt: null, excerpt: null, kind: "page-link", collectedAt: now, createdAt: now,
    });
    const [inserted] = await fixture!.db
      .select({ id: studyMaterials.id })
      .from(studyMaterials)
      .where(eq(studyMaterials.contentKey, contentKeys[6]));
    materialIds.set(contentKeys[6], inserted.id);
    await fixture!.db.insert(studyMaterialSources).values({
      materialId: inserted.id, sourceKey: sourceKeys[0], collectedAt: now,
    });

    const second = await listMaterials({
      sourceKey: sourceKeys[0], limit: 100, cursor: first.nextCursor!,
    }, repository);
    expect(second.items.map(({ contentKey }) => contentKey)).not.toContain(contentKeys[6]);
    await expect(listMaterials({
      sourceKey: sourceKeys[0], category: "techBlog", cursor: first.nextCursor!,
    }, repository)).rejects.toMatchObject({ status: 400, code: "INVALID_REQUEST" });
  });

  it("누적 추천 EXISTS를 DTO와 true/false 필터에 적용한다", async () => {
    const recommended = await listMaterials({ sourceKey: sourceKeys[0], recommended: true }, repository);
    const unrecommended = await listMaterials({ sourceKey: sourceKeys[0], recommended: false }, repository);
    expect(recommended.items.map(({ contentKey }) => contentKey)).toEqual([contentKeys[1]]);
    expect(unrecommended.items.map(({ contentKey }) => contentKey)).not.toContain(contentKeys[1]);
    expect(recommended.items[0]?.previouslyRecommended).toBe(true);
    expect(unrecommended.items.every(({ previouslyRecommended }) => !previouslyRecommended)).toBe(true);
  });

  it("미생성 상태를 false로 보고 starred/read boolean 필터를 적용한다", async () => {
    const starred = await listMaterials({ sourceKey: sourceKeys[0], starred: true }, repository);
    const unstarred = await listMaterials({ sourceKey: sourceKeys[0], starred: false }, repository);
    const read = await listMaterials({ sourceKey: sourceKeys[0], read: true }, repository);
    expect(starred.items.map(({ contentKey }) => contentKey)).toEqual([contentKeys[2]]);
    expect(unstarred.items.map(({ contentKey }) => contentKey)).not.toContain(contentKeys[2]);
    expect(read.items).toEqual([]);
  });

  it("최초 INSERT와 후속 UPDATE 경합에서 각각 한 번만 성공하고 메모를 병합하지 않는다", async () => {
    const id = materialIds.get(contentKeys[3])!;
    const inserted = await Promise.allSettled([
      updateMaterialState(id, { expectedVersion: 0, note: "device-a" }, repository),
      updateMaterialState(id, { expectedVersion: 0, note: "device-b" }, concurrentRepository),
    ]);
    expect(inserted.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(inserted.find(({ status }) => status === "rejected")).toMatchObject({
      status: "rejected", reason: expect.objectContaining({ status: 409, code: "VERSION_CONFLICT" }),
    });
    const afterInsert = await getMaterial(id, repository);
    expect(["device-a", "device-b"]).toContain(afterInsert.material.state.note);
    expect(afterInsert.material.state.version).toBe(1);

    const updated = await Promise.allSettled([
      updateMaterialState(id, { expectedVersion: 1, note: "update-a" }, repository),
      updateMaterialState(id, { expectedVersion: 1, note: "update-b" }, concurrentRepository),
    ]);
    expect(updated.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(updated.find(({ status }) => status === "rejected")).toMatchObject({
      status: "rejected", reason: expect.objectContaining({ status: 409, code: "VERSION_CONFLICT" }),
    });
    const afterUpdate = await getMaterial(id, repository);
    expect(["update-a", "update-b"]).toContain(afterUpdate.material.state.note);
    expect(afterUpdate.material.state.version).toBe(2);
  });

  it("생략한 메모를 보존하고 단건 없음과 DB 장애를 구분한다", async () => {
    const id = materialIds.get(contentKeys[2])!;
    const state = await updateMaterialState(id, { expectedVersion: 1, read: true }, repository);
    expect(state.state).toMatchObject({ read: true, note: "기존 메모", version: 2 });
    await expect(getMaterial(0xffffffff, repository)).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });

    const failingRepository = {
      getMaterial: async () => { throw new Error("database unavailable"); },
    } as unknown as StudyRepository;
    await expect(getMaterial(id, failingRepository)).rejects.toMatchObject({ status: 503, code: "UNAVAILABLE" });
  });
});
