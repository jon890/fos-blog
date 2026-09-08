import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { StudyRepository } from "@/infra/db/repositories";
import { createTestDatabase, migrateTestDatabase } from "@/infra/db/test-utils";
import { studySourceCursors, studySources } from "@/infra/db/schema";
import { StudyServiceError } from "./errors";
import { getSourceCursor, listSources, putSource } from "./sources";

const sourceKeys = [
  "p02-source-a",
  "p02-source-b",
  "p02-source-race",
  "p02-source-version",
  "p02-source-cursor",
];
const sourceInput = {
  title: "Phase 02 source",
  category: "techBlog" as const,
  url: "https://example.com/source",
  feedUrl: null,
  adapter: "page" as const,
  enabled: true,
  expectedVersion: 0,
};

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("소스 서비스 MySQL", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
  let concurrentFixture: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
  let repository: StudyRepository;
  let concurrentRepository: StudyRepository;

  beforeAll(async () => {
    fixture = await createTestDatabase();
    await migrateTestDatabase(fixture);
    concurrentFixture = await createTestDatabase();
    repository = new StudyRepository(fixture.db);
    concurrentRepository = new StudyRepository(concurrentFixture.db);
  }, 30_000);

  beforeEach(async () => {
    await fixture!.db.delete(studySourceCursors).where(inArray(studySourceCursors.sourceKey, sourceKeys));
    await fixture!.db.delete(studySources).where(inArray(studySources.sourceKey, sourceKeys));
  });

  afterEach(async () => {
    await fixture!.db.delete(studySourceCursors).where(inArray(studySourceCursors.sourceKey, sourceKeys));
    await fixture!.db.delete(studySources).where(inArray(studySources.sourceKey, sourceKeys));
  });

  afterAll(async () => {
    if (!fixture) return;
    try {
      await fixture.db.delete(studySourceCursors).where(inArray(studySourceCursors.sourceKey, sourceKeys));
      await fixture.db.delete(studySources).where(inArray(studySources.sourceKey, sourceKeys));
    } finally {
      await fixture.connection.end();
      await concurrentFixture?.connection.end();
    }
  });

  it("최초 소스와 recent/archive cursor를 한 트랜잭션에서 생성하고 목록을 정렬한다", async () => {
    const createdB = await putSource(sourceKeys[1], { ...sourceInput, enabled: false }, repository);
    const createdA = await putSource(sourceKeys[0], sourceInput, repository);
    expect(createdA).toMatchObject({ source: { sourceKey: sourceKeys[0], version: 1 }, version: 1 });
    expect(createdB.source.enabled).toBe(false);

    const cursors = await fixture!.db
      .select()
      .from(studySourceCursors)
      .where(eq(studySourceCursors.sourceKey, sourceKeys[0]));
    expect(cursors).toHaveLength(2);
    expect(cursors.map(({ mode, cursor, version }) => ({ mode, cursor, version })).sort((a, b) => a.mode.localeCompare(b.mode))).toEqual([
      { mode: "archive", cursor: null, version: 0 },
      { mode: "recent", cursor: null, version: 0 },
    ]);

    const listed = await listSources(repository);
    const ours = listed.sources.filter(({ sourceKey }) => sourceKeys.includes(sourceKey));
    expect(ours.map(({ sourceKey }) => sourceKey)).toEqual([sourceKeys[0], sourceKeys[1]]);
  });

  it("최초 생성 경합은 한 요청만 성공시키고 cursor 두 행만 남긴다", async () => {
    const results = await Promise.allSettled([
      putSource(sourceKeys[2], sourceInput, repository),
      putSource(sourceKeys[2], { ...sourceInput, title: "Racing source" }, concurrentRepository),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ status: 409, code: "VERSION_CONFLICT" }),
    });
    expect(
      await fixture!.db.select().from(studySourceCursors).where(eq(studySourceCursors.sourceKey, sourceKeys[2])),
    ).toHaveLength(2);
  });

  it("현재 version만 전체 교체하고 오래된 version은 기존 값을 덮어쓰지 않는다", async () => {
    await putSource(sourceKeys[3], sourceInput, repository);
    const updated = await putSource(sourceKeys[3], {
      ...sourceInput,
      title: "Updated source",
      expectedVersion: 1,
    }, repository);
    expect(updated).toMatchObject({ source: { title: "Updated source", version: 2 }, version: 2 });
    await expect(
      putSource(sourceKeys[3], { ...sourceInput, title: "Stale source", expectedVersion: 1 }, repository),
    ).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
    const rows = await fixture!.db.select().from(studySources).where(eq(studySources.sourceKey, sourceKeys[3]));
    expect(rows[0]).toMatchObject({ title: "Updated source", version: 2 });
  });

  it("cursor 기본값과 없는 소스를 구분하며 DB 장애를 503으로 보존한다", async () => {
    await putSource(sourceKeys[4], sourceInput, repository);
    await expect(getSourceCursor(sourceKeys[4], "archive", repository)).resolves.toEqual({
      sourceKey: sourceKeys[4], mode: "archive", cursor: null, version: 0,
    });
    await expect(getSourceCursor("p02-source-missing", "recent", repository)).rejects.toMatchObject({
      status: 404, code: "NOT_FOUND",
    });
    const failingRepository = {
      listSources: async () => { throw new Error("connection unavailable"); },
    } as unknown as StudyRepository;
    await expect(listSources(failingRepository)).rejects.toEqual(
      expect.objectContaining<Partial<StudyServiceError>>({ status: 503, code: "UNAVAILABLE" }),
    );
  });
});
