import { and, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { StudyRepository } from "@/infra/db/repositories";
import {
  studyMaterialSources,
  studyMaterialStates,
  studyMaterialTags,
  studyMaterials,
  studyRecommendationItems,
  studyRecommendationRuns,
  studyRecommendationTopics,
  studyRequestReceipts,
  studySourceCursors,
  studySources,
} from "@/infra/db/schema";
import { createTestDatabase, migrateTestDatabase } from "@/infra/db/test-utils";
import {
  ingestionRequestSchema,
  type IngestBatchInput,
  type IngestionMaterial,
} from "@/lib/study/contracts";
import { canonicalJson, studyRequestHash } from "@/lib/study/request-hash";
import { canonicalizeStudyUrl, studyContentKey } from "@/lib/study/url-identity";
import { ingestBatch } from "./ingestion";
import { putSource } from "./sources";

const sourceKeys = [
  "p03-replay",
  "p03-race",
  "p03-version",
  "p03-rollback",
  "p03-source-a",
  "p03-source-b",
  "p03-preserve",
  "p03-disabled",
];
const receiptKeys = [
  "p03-receipt-replay",
  "p03-receipt-race",
  "p03-receipt-version-a",
  "p03-receipt-version-b",
  "p03-receipt-rollback",
  "p03-receipt-source-a-1",
  "p03-receipt-source-a-2",
  "p03-receipt-source-b-1",
  "p03-receipt-source-b-2",
  "p03-receipt-empty",
  "p03-receipt-preserve-1",
  "p03-receipt-preserve-2",
  "p03-receipt-disabled",
];
const reportIds = ["p03-report-preserve"];
const materialKeys = new Set<string>();

const sourceInput = {
  title: "Phase 03 source",
  category: "techBlog" as const,
  url: "https://example.com/study",
  feedUrl: null,
  adapter: "page" as const,
  enabled: true,
  expectedVersion: 0,
};

function material(
  suffix: string,
  overrides: Partial<IngestionMaterial> = {},
): IngestionMaterial {
  const url = `https://example.com/articles/${suffix}`;
  const value: IngestionMaterial = {
    contentKey: studyContentKey(url),
    canonicalUrl: canonicalizeStudyUrl(url),
    url,
    title: `Material ${suffix}`,
    published: "2026-09-08",
    publishedAt: "2026-09-08T00:00:00.000Z",
    excerpt: `Excerpt ${suffix}`,
    kind: "page-link",
    tags: ["typescript", suffix],
    collectedAt: "2026-09-08T01:00:00.000Z",
    ...overrides,
  };
  materialKeys.add(value.contentKey);
  return value;
}

function batch(
  sourceKey: string,
  idempotencyKey: string,
  items: IngestionMaterial[],
  overrides: Partial<IngestBatchInput> = {},
): IngestBatchInput {
  return {
    sourceKey,
    mode: "recent",
    items,
    cursor: { page: 2 },
    expectedCursorVersion: 0,
    idempotencyKey,
    ...overrides,
  };
}

describe("수집 본문 정규화", () => {
  it("객체 key는 정렬하고 배열 순서는 보존해 SHA-256을 계산한다", () => {
    expect(canonicalJson({ z: 1, nested: { b: 2, a: 1 }, items: ["b", "a"] })).toBe(
      '{"items":["b","a"],"nested":{"a":1,"b":2},"z":1}',
    );
    expect(studyRequestHash({ b: 2, a: 1 })).toBe(studyRequestHash({ a: 1, b: 2 }));
    expect(studyRequestHash({ items: [1, 2] })).not.toBe(studyRequestHash({ items: [2, 1] }));
  });

  it("배치와 태그 배열 중복을 입력 오류로 거절한다", () => {
    const duplicate = material("duplicate");
    expect(ingestionRequestSchema.safeParse(batch("p03-replay", "p03-duplicate", [duplicate, duplicate])).success).toBe(false);
    expect(
      ingestionRequestSchema.safeParse(
        batch("p03-replay", "p03-tag-duplicate", [material("tag-duplicate", { tags: ["same", "same"] })]),
      ).success,
    ).toBe(false);
  });
});

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("자료 수집 서비스 MySQL", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
  let concurrentFixture: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
  let repository: StudyRepository;
  let concurrentRepository: StudyRepository;

  async function clean(): Promise<void> {
    if (!fixture) return;
    const runRows = await fixture.db
      .select({ id: studyRecommendationRuns.id })
      .from(studyRecommendationRuns)
      .where(inArray(studyRecommendationRuns.reportId, reportIds));
    const runIds = runRows.map(({ id }) => id);
    if (runIds.length > 0) {
      await fixture.db.delete(studyRecommendationItems).where(inArray(studyRecommendationItems.runId, runIds));
      await fixture.db.delete(studyRecommendationTopics).where(inArray(studyRecommendationTopics.runId, runIds));
      await fixture.db.delete(studyRecommendationRuns).where(inArray(studyRecommendationRuns.id, runIds));
    }
    const keys = [...materialKeys];
    if (keys.length > 0) {
      const rows = await fixture.db
        .select({ id: studyMaterials.id })
        .from(studyMaterials)
        .where(inArray(studyMaterials.contentKey, keys));
      const ids = rows.map(({ id }) => id);
      if (ids.length > 0) {
        await fixture.db.delete(studyMaterialStates).where(inArray(studyMaterialStates.materialId, ids));
        await fixture.db.delete(studyMaterialTags).where(inArray(studyMaterialTags.materialId, ids));
        await fixture.db.delete(studyMaterialSources).where(inArray(studyMaterialSources.materialId, ids));
        await fixture.db.delete(studyMaterials).where(inArray(studyMaterials.id, ids));
      }
    }
    await fixture.db
      .delete(studyRequestReceipts)
      .where(
        and(
          eq(studyRequestReceipts.operation, "ingestion"),
          inArray(studyRequestReceipts.requestKey, receiptKeys),
        ),
      );
    await fixture.db.delete(studySourceCursors).where(inArray(studySourceCursors.sourceKey, sourceKeys));
    await fixture.db.delete(studySources).where(inArray(studySources.sourceKey, sourceKeys));
    materialKeys.clear();
  }

  beforeAll(async () => {
    fixture = await createTestDatabase();
    await migrateTestDatabase(fixture);
    concurrentFixture = await createTestDatabase();
    repository = new StudyRepository(fixture.db);
    concurrentRepository = new StudyRepository(concurrentFixture.db);
  }, 30_000);

  beforeEach(clean);
  afterEach(clean);
  afterAll(async () => {
    try {
      await clean();
    } finally {
      await fixture?.connection.end();
      await concurrentFixture?.connection.end();
    }
  });

  it("응답 유실 재전송은 원래 영수증을 반환하고 다른 본문은 충돌시킨다", async () => {
    await putSource(sourceKeys[0], sourceInput, repository);
    const input = batch(sourceKeys[0], receiptKeys[0], [material("replay")]);
    const first = await ingestBatch(input, repository);
    await expect(ingestBatch(input, repository)).resolves.toEqual(first);
    await expect(
      ingestBatch({ ...input, cursor: { page: 3 } }, repository),
    ).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_CONFLICT" });
    const cursors = await fixture!.db
      .select()
      .from(studySourceCursors)
      .where(and(eq(studySourceCursors.sourceKey, sourceKeys[0]), eq(studySourceCursors.mode, "recent")));
    expect(cursors[0]).toMatchObject({ cursor: { page: 2 }, version: 1 });
  });

  it("동일 멱등 키 동시 요청은 같은 영수증 하나만 반환한다", async () => {
    await putSource(sourceKeys[1], sourceInput, repository);
    const input = batch(sourceKeys[1], receiptKeys[1], [material("race")]);
    const results = await Promise.all([
      ingestBatch(input, repository),
      ingestBatch(input, concurrentRepository),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toMatchObject({ acceptedCount: 1, cursorVersion: 1 });
    expect(
      await fixture!.db
        .select()
        .from(studyRequestReceipts)
        .where(eq(studyRequestReceipts.requestKey, receiptKeys[1])),
    ).toHaveLength(1);
  });

  it("다른 batch의 같은 cursor version 요청은 하나만 성공시킨다", async () => {
    await putSource(sourceKeys[2], sourceInput, repository);
    const results = await Promise.allSettled([
      ingestBatch(batch(sourceKeys[2], receiptKeys[2], [material("version-a")]), repository),
      ingestBatch(batch(sourceKeys[2], receiptKeys[3], [material("version-b")]), concurrentRepository),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.find(({ status }) => status === "rejected")).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ status: 409, code: "VERSION_CONFLICT" }),
    });
  });

  it("자료 중간 INSERT 실패는 자료와 cursor와 영수증을 모두 rollback한다", async () => {
    await putSource(sourceKeys[3], sourceInput, repository);
    const first = material("rollback-a");
    const invalid = material("rollback-z", { kind: "x".repeat(17) as IngestionMaterial["kind"] });
    await expect(
      ingestBatch(batch(sourceKeys[3], receiptKeys[4], [first, invalid]), repository),
    ).rejects.toMatchObject({ status: 503, code: "UNAVAILABLE" });
    expect(
      await fixture!.db.select().from(studyMaterials).where(inArray(studyMaterials.contentKey, [first.contentKey, invalid.contentKey])),
    ).toEqual([]);
    const cursor = await fixture!.db
      .select()
      .from(studySourceCursors)
      .where(and(eq(studySourceCursors.sourceKey, sourceKeys[3]), eq(studySourceCursors.mode, "recent")));
    expect(cursor[0]).toMatchObject({ cursor: null, version: 0 });
    expect(
      await fixture!.db.select().from(studyRequestReceipts).where(eq(studyRequestReceipts.requestKey, receiptKeys[4])),
    ).toEqual([]);
  });

  it("여러 소스 연결과 최신 collectedAt 메타 정책을 적용한다", async () => {
    await putSource(sourceKeys[4], sourceInput, repository);
    await putSource(sourceKeys[5], { ...sourceInput, title: "Second source" }, repository);
    const original = material("shared", { title: "Original", tags: ["original"] });
    await ingestBatch(batch(sourceKeys[4], receiptKeys[5], [original]), repository);
    const newer = material("shared", {
      title: "Newer",
      tags: ["newer"],
      collectedAt: "2026-09-08T02:00:00.000Z",
    });
    await ingestBatch(batch(sourceKeys[5], receiptKeys[7], [newer]), repository);
    const sameTime = material("shared", {
      title: "Same time must lose",
      tags: ["same-time"],
      collectedAt: "2026-09-08T02:00:00.000Z",
    });
    await ingestBatch(batch(sourceKeys[4], receiptKeys[6], [sameTime], { expectedCursorVersion: 1 }), repository);

    const rows = await fixture!.db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.contentKey, original.contentKey));
    expect(rows[0]).toMatchObject({ title: "Newer", collectedAt: new Date("2026-09-08T02:00:00.000Z") });
    const tags = await fixture!.db.select().from(studyMaterialTags).where(eq(studyMaterialTags.materialId, rows[0].id));
    expect(tags.map(({ tag }) => tag)).toEqual(["newer"]);
    const links = await fixture!.db
      .select()
      .from(studyMaterialSources)
      .where(eq(studyMaterialSources.materialId, rows[0].id));
    expect(links).toHaveLength(2);
    expect(links.every(({ collectedAt }) => collectedAt.getTime() === Date.parse("2026-09-08T02:00:00.000Z"))).toBe(true);
  });

  it("빈 배치는 cursor만 진행시키고 비활성 소스는 전체 거절한다", async () => {
    await putSource(sourceKeys[4], sourceInput, repository);
    await expect(
      ingestBatch(batch(sourceKeys[4], receiptKeys[9], [], { cursor: null }), repository),
    ).resolves.toEqual({ idempotencyKey: receiptKeys[9], acceptedCount: 0, cursorVersion: 1 });
    await putSource(sourceKeys[7], { ...sourceInput, enabled: false }, repository);
    await expect(
      ingestBatch(batch(sourceKeys[7], receiptKeys[12], [material("disabled")]), repository),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_REQUEST" });
  });

  it("최신 수집 갱신이 개인 note와 추천 snapshot을 보존한다", async () => {
    await putSource(sourceKeys[6], sourceInput, repository);
    const first = material("preserve", { title: "Stored title" });
    await ingestBatch(batch(sourceKeys[6], receiptKeys[10], [first]), repository);
    const stored = (
      await fixture!.db.select().from(studyMaterials).where(eq(studyMaterials.contentKey, first.contentKey))
    )[0];
    await fixture!.db.insert(studyMaterialStates).values({
      ownerKey: "owner",
      materialId: stored.id,
      starred: true,
      read: false,
      note: "keep this note",
      version: 1,
      updatedAt: new Date("2026-09-08T01:10:00.000Z"),
    });
    await fixture!.db.insert(studyRecommendationRuns).values({
      reportId: reportIds[0],
      generatedAt: new Date("2026-09-08T01:20:00.000Z"),
      committedAt: new Date("2026-09-08T01:20:00.000Z"),
      requestHash: "a".repeat(64),
      historyVersion: 1,
      origin: "live",
    });
    const run = (
      await fixture!.db.select().from(studyRecommendationRuns).where(eq(studyRecommendationRuns.reportId, reportIds[0]))
    )[0];
    await fixture!.db.insert(studyRecommendationTopics).values({
      runId: run.id,
      position: 0,
      topicKey: "preserve",
      title: "Preserve",
      careerQuestion: "Question",
    });
    const topic = (
      await fixture!.db.select().from(studyRecommendationTopics).where(eq(studyRecommendationTopics.runId, run.id))
    )[0];
    await fixture!.db.insert(studyRecommendationItems).values({
      runId: run.id,
      topicId: topic.id,
      position: 0,
      materialId: stored.id,
      title: "Snapshot title",
      canonicalUrl: stored.canonicalUrl,
      summary: "Snapshot summary",
      reason: "Snapshot reason",
      careerValue: "current-work",
    });

    await ingestBatch(
      batch(sourceKeys[6], receiptKeys[11], [
        material("preserve", { title: "Updated material", collectedAt: "2026-09-08T03:00:00.000Z" }),
      ], { expectedCursorVersion: 1 }),
      repository,
    );
    const state = await fixture!.db.select().from(studyMaterialStates).where(eq(studyMaterialStates.materialId, stored.id));
    const snapshot = await fixture!.db.select().from(studyRecommendationItems).where(eq(studyRecommendationItems.materialId, stored.id));
    expect(state[0]).toMatchObject({ note: "keep this note", version: 1 });
    expect(snapshot[0]).toMatchObject({ title: "Snapshot title", summary: "Snapshot summary" });
  });
});

describe("수집 deadlock 재시도", () => {
  it("deadlock 뒤 전체 트랜잭션을 다시 실행해 영수증을 반환한다", async () => {
    const deadlock = Object.assign(new Error("deadlock"), { errno: 1213 });
    const response = { idempotencyKey: "p03-deadlock-success", acceptedCount: 0, cursorVersion: 1 };
    const repository = {
      getIngestionReceipt: vi.fn().mockResolvedValue(null),
      ingestBatch: vi.fn()
        .mockRejectedValueOnce(deadlock)
        .mockResolvedValueOnce({ status: "success" as const, response }),
    };
    const input = batch("p03-replay", response.idempotencyKey, []);
    await expect(ingestBatch(input, repository)).resolves.toEqual(response);
    expect(repository.ingestBatch).toHaveBeenCalledTimes(2);
  });

  it("전체 트랜잭션을 최대 두 번 재시도한 뒤 503을 반환한다", async () => {
    const deadlock = Object.assign(new Error("deadlock"), { code: "ER_LOCK_DEADLOCK" });
    const repository = {
      getIngestionReceipt: vi.fn().mockResolvedValue(null),
      ingestBatch: vi.fn().mockRejectedValue(deadlock),
    };
    const input = batch("p03-replay", "p03-deadlock", []);
    await expect(ingestBatch(input, repository)).rejects.toMatchObject({ status: 503, code: "UNAVAILABLE" });
    expect(repository.ingestBatch).toHaveBeenCalledTimes(3);
    expect(repository.getIngestionReceipt).toHaveBeenCalledTimes(3);
  });

  it("cursor version 충돌은 자동 재시도하지 않는다", async () => {
    const repository = {
      getIngestionReceipt: vi.fn().mockResolvedValue(null),
      ingestBatch: vi.fn().mockResolvedValue({ status: "version_conflict" as const }),
    };
    await expect(
      ingestBatch(batch("p03-replay", "p03-version-no-retry", []), repository),
    ).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
    expect(repository.ingestBatch).toHaveBeenCalledOnce();
  });
});
