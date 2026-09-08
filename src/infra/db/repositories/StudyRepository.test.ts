import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, migrateTestDatabase } from "../test-utils";
import { studyRecommendationControl } from "../schema";
import { StudyRepository } from "./StudyRepository";

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("StudyRepository MySQL 동시성", () => {
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
    await fixture.db
      .delete(studyRecommendationControl)
      .where(eq(studyRecommendationControl.ownerKey, "owner"));
  }, 30_000);

  afterAll(async () => {
    if (!fixture) return;
    try {
      await fixture.db
        .delete(studyRecommendationControl)
        .where(eq(studyRecommendationControl.ownerKey, "owner"));
    } finally {
      await fixture.connection.end();
      await concurrentFixture?.connection.end();
    }
  });

  it("추천 control을 반복 호출과 생성 경합에서도 owner/0/null 한 행으로 유지한다", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        (index % 2 === 0 ? repository : concurrentRepository).ensureRecommendationControl("owner"),
      ),
    );
    expect(results).toHaveLength(8);
    expect(results.every((row) => row.historyVersion === 0 && row.latestRunId === null)).toBe(true);

    const rows = await fixture!.db
      .select({ total: count() })
      .from(studyRecommendationControl)
      .where(eq(studyRecommendationControl.ownerKey, "owner"));
    expect(rows[0]?.total).toBe(1);
  });
});
