import { and, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { StudyRepository } from "@/infra/db/repositories";
import {
  studyMaterialSources,
  studyMaterialStates,
  studyMaterials,
  studyPublications,
  studyRecommendationControl,
  studyRecommendationItems,
  studyRecommendationRuns,
  studyRecommendationTopics,
  studyRecommendedMaterials,
  studyRequestReceipts,
  studySources,
} from "@/infra/db/schema";
import { createTestDatabase, migrateTestDatabase } from "@/infra/db/test-utils";
import type {
  CreateRecommendationRunInput,
  PublicationInput,
} from "@/lib/study/contracts";
import {
  getRecommendationRun,
  listCandidates,
  listRecommendationRuns,
  recordPublication,
  saveRecommendationRun,
} from "./recommendations";

const ownerKey = "p64-owner";
const sourceKeys = ["p64-source-a", "p64-source-b", "p64-source-disabled"];
const contentKeys = ["p64:material-a", "p64:material-b", "p64:material-c"];
const reportIds = [
  "p64-race-a",
  "p64-race-b",
  "p64-replay",
  "p64-rollback",
  "p64-empty",
  "p64-page-change",
  "p64-null-history",
  "p64-publication",
  "p64-publication-reuse",
];
const publicationKeys = [
  "p64-publication-same",
  "p64-publication-race-a",
  "p64-publication-race-b",
  "p64-publication-conflict",
];
const now = new Date("2026-09-08T04:05:06.789Z");

function recommendation(
  reportId: string,
  topicKey: string,
  contentKey: string,
): CreateRecommendationRunInput {
  return {
    reportId,
    generatedAt: "2026-09-08T03:00:00.000Z",
    topics: [{
      topicKey,
      title: `Topic ${topicKey}`,
      careerQuestion: "이 자료를 업무에 어떻게 적용할 수 있는가?",
      items: [{
        contentKey,
        summary: "추천 시점 요약",
        reason: "추천 시점 이유",
        careerValue: "engineering-judgment",
      }],
    }],
  };
}

function publication(
  idempotencyKey: string,
  overrides: Partial<PublicationInput> = {},
): PublicationInput {
  return {
    idempotencyKey,
    reportId: "p64-publication",
    channel: "dooray",
    publishedAt: "2026-09-08T05:00:00.000Z",
    externalId: "task-1",
    url: "https://example.com/tasks/1",
    ...overrides,
  };
}

describe("추천과 게시 deadlock 재시도", () => {
  it("추천 저장은 deadlock 1회 뒤 전체 Repository 호출을 다시 실행한다", async () => {
    let attempts = 0;
    const input = recommendation("p64-replay", "retry-topic", contentKeys[0]);
    const retryingRepository = {
      saveRecommendationRun: async () => {
        attempts += 1;
        if (attempts === 1) throw { code: "ER_LOCK_DEADLOCK" };
        return {
          status: "success" as const,
          response: { reportId: input.reportId, historyVersion: 7 },
        };
      },
    } as unknown as StudyRepository;

    await expect(saveRecommendationRun(input, ownerKey, retryingRepository)).resolves.toEqual({
      reportId: input.reportId,
      historyVersion: 7,
    });
    expect(attempts).toBe(2);
  });

  it("추천 저장은 3회 연속 deadlock 뒤 UNAVAILABLE을 반환한다", async () => {
    let attempts = 0;
    const failingRepository = {
      saveRecommendationRun: async () => {
        attempts += 1;
        throw { cause: { errno: 1213 } };
      },
    } as unknown as StudyRepository;

    await expect(
      saveRecommendationRun(
        recommendation("p64-replay", "retry-topic", contentKeys[0]),
        ownerKey,
        failingRepository,
      ),
    ).rejects.toMatchObject({ status: 503, code: "UNAVAILABLE" });
    expect(attempts).toBe(3);
  });

  it("게시 기록은 deadlock 1회 뒤 전체 Repository 호출을 다시 실행한다", async () => {
    let attempts = 0;
    const retryingRepository = {
      recordPublication: async () => {
        attempts += 1;
        if (attempts === 1) throw { sqlState: "40001" };
        return { status: "success" as const, response: { publicationId: 11 } };
      },
    } as unknown as StudyRepository;

    await expect(
      recordPublication(publication(publicationKeys[0]), retryingRepository),
    ).resolves.toEqual({ publicationId: 11 });
    expect(attempts).toBe(2);
  });

  it("게시 기록은 3회 연속 deadlock 뒤 UNAVAILABLE을 반환한다", async () => {
    let attempts = 0;
    const failingRepository = {
      recordPublication: async () => {
        attempts += 1;
        throw { code: "ER_LOCK_DEADLOCK" };
      },
    } as unknown as StudyRepository;

    await expect(
      recordPublication(publication(publicationKeys[0]), failingRepository),
    ).rejects.toMatchObject({ status: 503, code: "UNAVAILABLE" });
    expect(attempts).toBe(3);
  });
});

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("추천과 게시 이력 서비스 MySQL", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
  let concurrentFixture: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
  let repository: StudyRepository;
  let concurrentRepository: StudyRepository;
  const materialIds = new Map<string, number>();

  async function cleanup(): Promise<void> {
    if (!fixture) return;
    await fixture.db
      .delete(studyRequestReceipts)
      .where(
        and(
          eq(studyRequestReceipts.operation, "publication"),
          inArray(studyRequestReceipts.requestKey, publicationKeys),
        ),
      );
    await fixture.db.delete(studyRecommendationControl).where(eq(studyRecommendationControl.ownerKey, ownerKey));
    const runs = await fixture.db
      .select({ id: studyRecommendationRuns.id })
      .from(studyRecommendationRuns)
      .where(inArray(studyRecommendationRuns.reportId, reportIds));
    const runIds = runs.map(({ id }) => id);
    if (runIds.length > 0) {
      await fixture.db.delete(studyPublications).where(inArray(studyPublications.runId, runIds));
      await fixture.db.delete(studyRecommendationItems).where(inArray(studyRecommendationItems.runId, runIds));
      await fixture.db.delete(studyRecommendedMaterials).where(inArray(studyRecommendedMaterials.firstRunId, runIds));
      await fixture.db.delete(studyRecommendationTopics).where(inArray(studyRecommendationTopics.runId, runIds));
      await fixture.db.delete(studyRecommendationRuns).where(inArray(studyRecommendationRuns.id, runIds));
    }
    const materials = await fixture.db
      .select({ id: studyMaterials.id })
      .from(studyMaterials)
      .where(inArray(studyMaterials.contentKey, contentKeys));
    const ids = materials.map(({ id }) => id);
    if (ids.length > 0) {
      await fixture.db.delete(studyMaterialStates).where(inArray(studyMaterialStates.materialId, ids));
      await fixture.db.delete(studyMaterialSources).where(inArray(studyMaterialSources.materialId, ids));
      await fixture.db.delete(studyMaterials).where(inArray(studyMaterials.id, ids));
    }
    await fixture.db.delete(studySources).where(inArray(studySources.sourceKey, sourceKeys));
    materialIds.clear();
  }

  async function seed(): Promise<void> {
    await fixture!.db.insert(studySources).values([
      {
        sourceKey: sourceKeys[0], title: "A source", category: "techBlog",
        url: "https://example.com/source-a", feedUrl: null, adapter: "page", enabled: true,
        version: 1, updatedAt: now,
      },
      {
        sourceKey: sourceKeys[1], title: "B source", category: "ai",
        url: "https://example.com/source-b", feedUrl: null, adapter: "page", enabled: true,
        version: 1, updatedAt: now,
      },
      {
        sourceKey: sourceKeys[2], title: "Disabled source", category: "video",
        url: "https://example.com/source-disabled", feedUrl: null, adapter: "page", enabled: false,
        version: 1, updatedAt: now,
      },
    ]);
    await fixture!.db.insert(studyMaterials).values(contentKeys.map((contentKey, index) => ({
      contentKey,
      canonicalUrl: `https://example.com/materials/${index}`,
      url: `https://example.com/materials/${index}?from=source`,
      title: `Material ${index}`,
      published: "2026-09-08",
      publishedAt: new Date(`2026-09-08T0${index}:00:00.000Z`),
      excerpt: index === 0 ? null : `Excerpt ${index}`,
      kind: index === 2 ? "page-video" : "page-link",
      collectedAt: now,
      createdAt: now,
    })));
    const rows = await fixture!.db
      .select({ id: studyMaterials.id, contentKey: studyMaterials.contentKey })
      .from(studyMaterials)
      .where(inArray(studyMaterials.contentKey, contentKeys));
    for (const row of rows) materialIds.set(row.contentKey, row.id);
    await fixture!.db.insert(studyMaterialSources).values([
      { materialId: materialIds.get(contentKeys[0])!, sourceKey: sourceKeys[0], collectedAt: now },
      { materialId: materialIds.get(contentKeys[0])!, sourceKey: sourceKeys[1], collectedAt: now },
      { materialId: materialIds.get(contentKeys[1])!, sourceKey: sourceKeys[1], collectedAt: now },
      { materialId: materialIds.get(contentKeys[2])!, sourceKey: sourceKeys[1], collectedAt: now },
      { materialId: materialIds.get(contentKeys[2])!, sourceKey: sourceKeys[2], collectedAt: now },
    ]);
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

  afterEach(cleanup);

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      await fixture?.connection.end();
      await concurrentFixture?.connection.end();
    }
  });

  it("활성 sourceKey 오름차순과 source 필터를 적용하고 null excerpt를 생략한다", async () => {
    const all = await listCandidates({ limit: 100 }, ownerKey, repository);
    const firstMaterial = all.candidates.find(({ contentKey }) => contentKey === contentKeys[0]);
    expect(firstMaterial).toMatchObject({
      id: contentKeys[0],
      sourceKey: sourceKeys[0],
      previouslyRecommended: false,
    });
    expect(firstMaterial).not.toHaveProperty("excerpt");
    expect(all.candidates.every(({ sourceKey }) => sourceKey !== sourceKeys[2])).toBe(true);

    const filtered = await listCandidates({ sourceKey: sourceKeys[1], limit: 100 }, ownerKey, repository);
    expect(filtered.candidates).toHaveLength(3);
    expect(filtered.candidates.every(({ sourceKey }) => sourceKey === sourceKeys[1])).toBe(true);
    const category = await listCandidates({ category: "techBlog" }, ownerKey, repository);
    const categoryKeys = category.candidates.map(({ contentKey }) => contentKey);
    expect(categoryKeys).toContain(contentKeys[0]);
    expect(categoryKeys).not.toContain(contentKeys[1]);
    expect(categoryKeys).not.toContain(contentKeys[2]);
  });

  it("추천 이력이 후보 페이지 사이에 바뀌면 고정한 historyVersion으로 충돌한다", async () => {
    const first = await listCandidates({ limit: 1 }, ownerKey, repository);
    expect(first.historyVersion).toBe(0);
    expect(first.nextCursor).not.toBeNull();
    await saveRecommendationRun({
      reportId: "p64-page-change",
      generatedAt: "2026-09-08T03:00:00.000Z",
      topics: [],
    }, ownerKey, repository);
    await expect(
      listCandidates({ limit: 1, cursor: first.nextCursor! }, ownerKey, repository),
    ).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
  });

  it("같은 자료와 주제를 고른 동시 추천 중 하나만 commit한다", async () => {
    const results = await Promise.allSettled([
      saveRecommendationRun(recommendation("p64-race-a", "same-topic", contentKeys[0]), ownerKey, repository),
      saveRecommendationRun(recommendation("p64-race-b", "same-topic", contentKeys[0]), ownerKey, concurrentRepository),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.find(({ status }) => status === "rejected")).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ status: 409 }),
    });
    const runs = await fixture!.db
      .select()
      .from(studyRecommendationRuns)
      .where(inArray(studyRecommendationRuns.reportId, ["p64-race-a", "p64-race-b"]));
    expect(runs).toHaveLength(1);
    expect(await repository.getRecommendationHistory(ownerKey)).toEqual({
      historyVersion: 1,
      recentTopicKeys: ["same-topic"],
    });
  });

  it("같은 reportId와 본문 재시도는 원래 버전을 반환하고 다른 본문은 충돌한다", async () => {
    const input = recommendation("p64-replay", "replay-topic", contentKeys[0]);
    const first = await saveRecommendationRun(input, ownerKey, repository);
    await expect(saveRecommendationRun(input, ownerKey, repository)).resolves.toEqual(first);
    await expect(
      saveRecommendationRun({ ...input, generatedAt: "2026-09-08T03:01:00.000Z" }, ownerKey, repository),
    ).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_CONFLICT" });
    expect(first.historyVersion).toBe(1);
  });

  it("추천 중간 INSERT 실패는 run과 누적 집합과 control 갱신을 모두 rollback한다", async () => {
    const invalid = {
      ...recommendation("p64-rollback", "rollback-topic", contentKeys[0]),
      topics: [{
        topicKey: "rollback-topic",
        title: "Rollback topic",
        careerQuestion: "Rollback question",
        items: [
          {
            contentKey: contentKeys[0], summary: "valid", reason: "valid",
            careerValue: "engineering-judgment",
          },
          {
            contentKey: contentKeys[1], summary: "x".repeat(301), reason: "invalid",
            careerValue: "engineering-judgment",
          },
        ],
      }],
    } as CreateRecommendationRunInput;
    await expect(saveRecommendationRun(invalid, ownerKey, repository)).rejects.toMatchObject({
      status: 503,
      code: "UNAVAILABLE",
    });
    expect(
      await fixture!.db.select().from(studyRecommendationRuns).where(eq(studyRecommendationRuns.reportId, "p64-rollback")),
    ).toEqual([]);
    expect(
      await fixture!.db.select().from(studyRecommendedMaterials).where(eq(studyRecommendedMaterials.ownerKey, ownerKey)),
    ).toEqual([]);
    expect(await repository.getRecommendationHistory(ownerKey)).toEqual({ historyVersion: 0, recentTopicKeys: [] });
  });

  it("빈 추천을 최신 정상 이력으로 저장하고 과거 null 설명은 상세 조회에서 보존한다", async () => {
    await expect(saveRecommendationRun({
      reportId: "p64-empty",
      generatedAt: "2026-09-08T03:00:00.000Z",
      topics: [],
    }, ownerKey, repository)).resolves.toEqual({ reportId: "p64-empty", historyVersion: 1 });
    expect(await repository.getRecommendationHistory(ownerKey)).toEqual({ historyVersion: 1, recentTopicKeys: [] });

    const inserted = await fixture!.db.insert(studyRecommendationRuns).values({
      reportId: "p64-null-history",
      generatedAt: now,
      committedAt: now,
      requestHash: "a".repeat(64),
      historyVersion: 2,
      origin: "import",
    });
    const runId = Number(inserted[0].insertId);
    const insertedTopic = await fixture!.db.insert(studyRecommendationTopics).values({
      runId,
      position: 0,
      topicKey: "past-topic",
      title: "Past topic",
      careerQuestion: null,
    });
    await fixture!.db.insert(studyRecommendationItems).values({
      runId,
      topicId: Number(insertedTopic[0].insertId),
      position: 0,
      materialId: materialIds.get(contentKeys[0])!,
      title: "Past snapshot title",
      canonicalUrl: "https://example.com/past-snapshot",
      summary: null,
      reason: null,
      careerValue: null,
    });
    const detail = await getRecommendationRun("p64-null-history", ownerKey, repository);
    expect(detail.topics[0]).toMatchObject({ careerQuestion: null });
    expect(detail.topics[0].items[0]).toMatchObject({
      title: "Past snapshot title",
      canonicalUrl: "https://example.com/past-snapshot",
      summary: null,
      reason: null,
      careerValue: null,
      state: { starred: false, read: false, note: "", version: 0, updatedAt: null },
    });
    const listed = await listRecommendationRuns({ limit: 1 }, repository);
    expect(listed.items).toHaveLength(1);
    expect(listed.nextCursor).not.toBeNull();
  });

  it("추천 snapshot은 유지하고 상세 state만 현재 값을 반환한다", async () => {
    await saveRecommendationRun(recommendation("p64-publication-reuse", "snapshot-topic", contentKeys[0]), ownerKey, repository);
    const materialId = materialIds.get(contentKeys[0])!;
    await fixture!.db.update(studyMaterials).set({
      title: "Current title",
      canonicalUrl: "https://example.com/current",
    }).where(eq(studyMaterials.id, materialId));
    await fixture!.db.insert(studyMaterialStates).values({
      ownerKey,
      materialId,
      starred: true,
      read: true,
      note: "current note",
      version: 1,
      updatedAt: now,
    });
    const detail = await getRecommendationRun("p64-publication-reuse", ownerKey, repository);
    expect(detail.topics[0].items[0]).toMatchObject({
      title: "Material 0",
      canonicalUrl: "https://example.com/materials/0",
      state: { starred: true, read: true, note: "current note", version: 1 },
    });
  });

  it("게시 멱등키와 고유 키 경합은 같은 ID를 반환하고 다른 본문은 추천 이력을 보존한 채 충돌한다", async () => {
    await saveRecommendationRun(recommendation("p64-publication", "publication-topic", contentKeys[0]), ownerKey, repository);
    const sameRequest = publication(publicationKeys[0], {
      externalId: "task-same",
      url: "https://example.com/tasks/same",
    });
    const sameResults = await Promise.all([
      recordPublication(sameRequest, repository),
      recordPublication(sameRequest, concurrentRepository),
    ]);
    expect(sameResults[0]).toEqual(sameResults[1]);

    const uniqueKeyResults = await Promise.all([
      recordPublication(publication(publicationKeys[1]), repository),
      recordPublication(publication(publicationKeys[2]), concurrentRepository),
    ]);
    expect(uniqueKeyResults[0]).toEqual(uniqueKeyResults[1]);
    await expect(
      recordPublication(publication(publicationKeys[3], { url: "https://example.com/tasks/changed" }), repository),
    ).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_CONFLICT" });
    await expect(
      recordPublication({ ...sameRequest, externalId: "task-2" }, repository),
    ).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_CONFLICT" });

    const rows = await fixture!.db
      .select()
      .from(studyPublications)
      .where(eq(studyPublications.externalId, "task-1"));
    expect(rows).toHaveLength(1);
    const detail = await getRecommendationRun("p64-publication", ownerKey, repository);
    expect(detail.topics).toHaveLength(1);
    expect(detail.publications).toEqual(expect.arrayContaining([
      {
        publicationId: sameResults[0].publicationId,
        channel: "dooray",
        publishedAt: "2026-09-08T05:00:00.000Z",
        externalId: "task-same",
        url: "https://example.com/tasks/same",
      },
      {
        publicationId: uniqueKeyResults[0].publicationId,
        channel: "dooray",
        publishedAt: "2026-09-08T05:00:00.000Z",
        externalId: "task-1",
        url: "https://example.com/tasks/1",
      },
    ]));
    await expect(
      saveRecommendationRun(recommendation("p64-publication-reuse", "different-topic", contentKeys[0]), ownerKey, repository),
    ).rejects.toMatchObject({ status: 409, code: "ALREADY_RECOMMENDED" });
  });
});
