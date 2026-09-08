import { and, asc, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { StudyRepository } from "@/infra/db/repositories";
import {
  studyMaterialSources,
  studyMaterials,
  studyRecommendationControl,
  studyRecommendationItems,
  studyRecommendationRuns,
  studyRecommendationTopics,
  studyRecommendedMaterials,
  studyRequestReceipts,
  studySourceCursors,
  studySources,
} from "@/infra/db/schema";
import { createTestDatabase, migrateTestDatabase } from "@/infra/db/test-utils";
import {
  importCommitRequestSchema,
  importDryRunRequestSchema,
  type ImportCommitRequest,
  type ImportDryRunRequest,
  type ImportItem,
  type ImportReport,
} from "@/lib/study/contracts";
import { canonicalizeStudyUrl, studyContentKey } from "@/lib/study/url-identity";
import { saveRecommendationRun } from "./recommendations";
import { commitImport, previewImport } from "./imports";
import { putSource } from "./sources";

const ownerKey = "p64-import-owner";
const sourceKeys = ["p64-import-source-a", "p64-import-source-b"];
const importKeys = new Set([
  "p64-dry-run", "p64-missing-source", "p64-category-mismatch", "p64-commit",
  "p64-existing-first", "p64-existing-replay", "p64-existing-conflict",
  "p64-changed-history", "p64-changed-payload", "p64-concurrent", "p64-rollback",
  "p64-latest-recent", "p64-latest-old",
]);
const reportIds = new Set([
  "p64-dry-a", "p64-dry-b", "p64-missing-source", "p64-category-mismatch",
  "p64-commit-old", "p64-commit-new", "p64-existing-report", "p64-changed-history",
  "p64-live-recommendation", "p64-changed-payload", "p64-concurrent", "p64-rollback",
  "p64-latest-recent", "p64-latest-old",
]);
const materialKeys = new Set([
  "dry-repeated", "dry-new", "missing-source", "category-mismatch", "commit-repeated",
  "commit-created", "existing", "changed-history", "live-recommendation", "changed-payload",
  "concurrent", "rollback-first", "rollback-second", "latest-recent", "latest-old",
].map((suffix) => studyContentKey(`https://example.com/import/${suffix}`)));

const sourceInput = {
  title: "Phase 64 import source",
  category: "techBlog" as const,
  url: "https://example.com/study",
  feedUrl: null,
  adapter: "page" as const,
  enabled: true,
  expectedVersion: 0,
};

function item(suffix: string, overrides: Partial<ImportItem> = {}): ImportItem {
  const canonicalUrl = canonicalizeStudyUrl(`https://example.com/import/${suffix}`);
  const value: ImportItem = {
    contentKey: studyContentKey(canonicalUrl),
    canonicalUrl,
    sourceKey: sourceKeys[0],
    title: `Historical ${suffix}`,
    category: "techBlog",
    summary: null,
    reason: null,
    careerValue: null,
    ...overrides,
  };
  materialKeys.add(value.contentKey);
  return value;
}

function report(
  reportId: string,
  generatedAt: string,
  items: ImportItem[],
  overrides: Partial<ImportReport> = {},
): ImportReport {
  reportIds.add(reportId);
  return {
    reportId,
    generatedAt,
    topics: [{
      topicKey: `topic-${reportId.replaceAll(/[^a-z0-9]+/g, "-")}`,
      title: `Topic ${reportId}`,
      careerQuestion: null,
      items,
    }],
    ...overrides,
  };
}

function payload(importKey: string, reports: ImportReport[]): ImportDryRunRequest {
  importKeys.add(importKey);
  return { importKey, reports };
}

function commitRequest(
  input: ImportDryRunRequest,
  preview: Awaited<ReturnType<typeof previewImport>>,
): ImportCommitRequest {
  return {
    ...input,
    previewHash: preview.previewHash,
    expectedHistoryVersion: preview.historyVersion,
  };
}

describe("과거 이력 가져오기 입력", () => {
  it("누락 설명 null을 보존하고 정규 URL과 리포트 중복을 검증한다", () => {
    const historical = item("schema-null");
    expect(importDryRunRequestSchema.parse(payload("p64-schema-null", [
      report("p64-schema-null", "2025-01-01T00:00:00.000Z", [historical]),
    ])).reports[0].topics[0]).toMatchObject({
      careerQuestion: null,
      items: [{ summary: null, reason: null, careerValue: null }],
    });
    expect(importDryRunRequestSchema.safeParse({
      importKey: "p64-schema-bad-url",
      reports: [report("p64-schema-bad-url", "2025-01-01T00:00:00.000Z", [
        { ...item("schema-bad-url"), canonicalUrl: "https://example.com/not-the-key" },
      ])],
    }).success).toBe(false);
    const duplicateReport = report("p64-schema-duplicate", "2025-01-01T00:00:00.000Z", [item("schema-duplicate")]);
    expect(importDryRunRequestSchema.safeParse({
      importKey: "p64-schema-duplicate",
      reports: [duplicateReport, duplicateReport],
    }).success).toBe(false);
    expect(importCommitRequestSchema.safeParse({
      ...payload("p64-schema-commit", [duplicateReport]),
      previewHash: "a".repeat(64),
      expectedHistoryVersion: 0,
    }).success).toBe(true);
  });
});

describe("과거 이력 commit deadlock 재시도", () => {
  const input: ImportCommitRequest = {
    ...payload("p64-import-deadlock", [
      report("p64-import-deadlock", "2025-01-01T00:00:00.000Z", [item("import-deadlock")]),
    ]),
    previewHash: "a".repeat(64),
    expectedHistoryVersion: 0,
  };
  const response = {
    importKey: input.importKey,
    counts: { reports: 1, items: 1, newMaterials: 1, repeatedContentKeys: 0, existingReports: 0 },
    historyVersion: 1,
  };

  it("deadlock 1회 뒤 Repository commit 전체 호출을 다시 실행한다", async () => {
    const repository = {
      commitImport: vi.fn()
        .mockRejectedValueOnce({ code: "ER_LOCK_DEADLOCK" })
        .mockResolvedValueOnce({ status: "success" as const, response }),
    } as unknown as StudyRepository;

    await expect(commitImport(input, ownerKey, repository)).resolves.toEqual(response);
    expect(repository.commitImport).toHaveBeenCalledTimes(2);
  });

  it("3회 연속 deadlock 뒤 UNAVAILABLE을 반환한다", async () => {
    const repository = {
      commitImport: vi.fn().mockRejectedValue({ cause: { sqlState: "40001" } }),
    } as unknown as StudyRepository;

    await expect(commitImport(input, ownerKey, repository)).rejects.toMatchObject({
      status: 503,
      code: "UNAVAILABLE",
    });
    expect(repository.commitImport).toHaveBeenCalledTimes(3);
  });
});

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("과거 이력 가져오기 MySQL", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
  let concurrentFixture: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
  let repository: StudyRepository;
  let concurrentRepository: StudyRepository;

  async function clean(): Promise<void> {
    if (!fixture) return;
    await fixture.db
      .update(studyRecommendationControl)
      .set({ latestRunId: null })
      .where(eq(studyRecommendationControl.ownerKey, ownerKey));
    const reports = [...reportIds];
    const runs = reports.length === 0
      ? []
      : await fixture.db
        .select({ id: studyRecommendationRuns.id })
        .from(studyRecommendationRuns)
        .where(inArray(studyRecommendationRuns.reportId, reports));
    const runIds = runs.map(({ id }) => id);
    const keys = [...materialKeys];
    const materials = keys.length === 0
      ? []
      : await fixture.db
        .select({ id: studyMaterials.id })
        .from(studyMaterials)
        .where(inArray(studyMaterials.contentKey, keys));
    const materialIds = materials.map(({ id }) => id);
    if (materialIds.length > 0) {
      await fixture.db.delete(studyRecommendedMaterials).where(inArray(studyRecommendedMaterials.materialId, materialIds));
      await fixture.db.delete(studyRecommendationItems).where(inArray(studyRecommendationItems.materialId, materialIds));
    }
    if (runIds.length > 0) {
      await fixture.db.delete(studyRecommendedMaterials).where(inArray(studyRecommendedMaterials.firstRunId, runIds));
      await fixture.db.delete(studyRecommendationItems).where(inArray(studyRecommendationItems.runId, runIds));
      await fixture.db.delete(studyRecommendationTopics).where(inArray(studyRecommendationTopics.runId, runIds));
      await fixture.db.delete(studyRecommendationRuns).where(inArray(studyRecommendationRuns.id, runIds));
    }
    await fixture.db.delete(studyRecommendationControl).where(eq(studyRecommendationControl.ownerKey, ownerKey));
    if (materialIds.length > 0) {
      await fixture.db.delete(studyMaterialSources).where(inArray(studyMaterialSources.materialId, materialIds));
      await fixture.db.delete(studyMaterials).where(inArray(studyMaterials.id, materialIds));
    }
    const keysToDelete = [...importKeys];
    if (keysToDelete.length > 0) {
      await fixture.db.delete(studyRequestReceipts).where(
        and(
          eq(studyRequestReceipts.operation, "import"),
          inArray(studyRequestReceipts.requestKey, keysToDelete),
        ),
      );
    }
    await fixture.db.delete(studySourceCursors).where(inArray(studySourceCursors.sourceKey, sourceKeys));
    await fixture.db.delete(studySources).where(inArray(studySources.sourceKey, sourceKeys));
  }

  async function databaseSnapshot() {
    return Promise.all([
      fixture!.db.select().from(studyMaterials),
      fixture!.db.select().from(studyMaterialSources),
      fixture!.db.select().from(studyRecommendationControl),
      fixture!.db.select().from(studyRecommendationRuns),
      fixture!.db.select().from(studyRecommendationTopics),
      fixture!.db.select().from(studyRecommendationItems),
      fixture!.db.select().from(studyRecommendedMaterials),
      fixture!.db.select().from(studyRequestReceipts),
    ]);
  }

  async function addSource(sourceKey = sourceKeys[0]): Promise<void> {
    await putSource(sourceKey, sourceInput, repository);
  }

  async function addMaterial(value: ImportItem, title = "Current material"): Promise<number> {
    const now = new Date("2026-09-08T00:00:00.000Z");
    const inserted = await fixture!.db.insert(studyMaterials).values({
      contentKey: value.contentKey,
      canonicalUrl: value.canonicalUrl,
      url: value.canonicalUrl,
      title,
      published: "2026-09-08",
      publishedAt: now,
      excerpt: "Current excerpt",
      kind: "page-link",
      collectedAt: now,
      createdAt: now,
    });
    return Number(inserted[0].insertId);
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

  it("dry-run은 행과 버전을 쓰지 않고 반복 자료와 신규 자료 개수를 계산한다", async () => {
    await addSource();
    const repeated = item("dry-repeated");
    const input = payload("p64-dry-run", [
      report("p64-dry-a", "2025-01-01T00:00:00.000Z", [repeated]),
      report("p64-dry-b", "2025-02-01T00:00:00.000Z", [repeated, item("dry-new")]),
    ]);
    const before = await databaseSnapshot();
    await expect(previewImport(input, ownerKey, repository)).resolves.toMatchObject({
      historyVersion: 0,
      counts: { reports: 2, items: 3, newMaterials: 2, repeatedContentKeys: 1, existingReports: 0 },
      warnings: [{ code: "REPEATED_CONTENT_KEY" }],
    });
    expect(await databaseSnapshot()).toEqual(before);
    await expect(previewImport(payload("p64-missing-source", [
      report("p64-missing-source", "2025-01-01T00:00:00.000Z", [
        item("missing-source", { sourceKey: "p64-not-registered" }),
      ]),
    ]), ownerKey, repository)).rejects.toMatchObject({ status: 400, code: "INVALID_REQUEST" });
    await expect(previewImport(payload("p64-category-mismatch", [
      report("p64-category-mismatch", "2025-01-01T00:00:00.000Z", [
        item("category-mismatch", { category: "ai" }),
      ]),
    ]), ownerKey, repository)).rejects.toMatchObject({ status: 400, code: "INVALID_REQUEST" });
  });

  it("commit은 null snapshot과 과거 반복 이력을 보존하고 기존 자료 메타는 바꾸지 않는다", async () => {
    await addSource();
    await addSource(sourceKeys[1]);
    const repeated = item("commit-repeated");
    const existingId = await addMaterial(repeated);
    const input = payload("p64-commit", [
      report("p64-commit-old", "2025-01-01T00:00:00.000Z", [
        { ...repeated, sourceKey: sourceKeys[1] },
      ]),
      report("p64-commit-new", "2025-02-01T00:00:00.000Z", [repeated, item("commit-created")]),
    ]);
    const preview = await previewImport(input, ownerKey, repository);
    await expect(commitImport(commitRequest(input, preview), ownerKey, repository)).resolves.toEqual({
      importKey: input.importKey,
      counts: { reports: 2, items: 3, newMaterials: 1, repeatedContentKeys: 1, existingReports: 0 },
      historyVersion: 1,
    });

    const runs = await fixture!.db
      .select()
      .from(studyRecommendationRuns)
      .where(inArray(studyRecommendationRuns.reportId, [...reportIds]))
      .orderBy(asc(studyRecommendationRuns.id));
    expect(runs.map(({ reportId }) => reportId)).toEqual(["p64-commit-old", "p64-commit-new"]);
    expect(runs.every((run) => run.origin === "import" && run.historyVersion === 1)).toBe(true);
    const snapshots = await fixture!.db
      .select()
      .from(studyRecommendationItems)
      .where(inArray(studyRecommendationItems.runId, runs.map(({ id }) => id)));
    expect(snapshots).toHaveLength(3);
    expect(snapshots.every((snapshot) => snapshot.summary === null && snapshot.reason === null && snapshot.careerValue === null)).toBe(true);
    expect((await fixture!.db
      .select()
      .from(studyRecommendationTopics)
      .where(inArray(studyRecommendationTopics.runId, runs.map(({ id }) => id))))
      .every((topic) => topic.careerQuestion === null)).toBe(true);
    expect((await fixture!.db.select().from(studyMaterials).where(eq(studyMaterials.id, existingId)))[0]).toMatchObject({
      title: "Current material",
      excerpt: "Current excerpt",
    });
    expect((await fixture!.db.select().from(studyMaterials).where(eq(
      studyMaterials.contentKey,
      studyContentKey("https://example.com/import/commit-created"),
    )))[0]).toMatchObject({
      url: "https://example.com/import/commit-created",
      published: "",
      publishedAt: null,
      excerpt: null,
      kind: "page-link",
    });
    expect(await fixture!.db.select().from(studyMaterialSources).where(eq(studyMaterialSources.materialId, existingId))).toHaveLength(2);
    expect(await repository.getRecommendationHistory(ownerKey)).toMatchObject({
      historyVersion: 1,
      recentTopicKeys: ["topic-p64-commit-new"],
    });
    expect(await fixture!.db.select().from(studyRecommendedMaterials).where(eq(studyRecommendedMaterials.ownerKey, ownerKey))).toHaveLength(2);
  });

  it("동일 기존 리포트는 건너뛰고 다른 정규 내용은 충돌한다", async () => {
    await addSource();
    const original = payload("p64-existing-first", [
      report("p64-existing-report", "2025-03-01T00:00:00.000Z", [item("existing")]),
    ]);
    const firstPreview = await previewImport(original, ownerKey, repository);
    await commitImport(commitRequest(original, firstPreview), ownerKey, repository);

    const replay = payload("p64-existing-replay", original.reports);
    const replayPreview = await previewImport(replay, ownerKey, repository);
    expect(replayPreview.counts.existingReports).toBe(1);
    await expect(commitImport(commitRequest(replay, replayPreview), ownerKey, repository)).resolves.toMatchObject({
      counts: { existingReports: 1 },
      historyVersion: 2,
    });
    expect(await fixture!.db.select().from(studyRecommendationRuns).where(eq(studyRecommendationRuns.reportId, "p64-existing-report"))).toHaveLength(1);

    const conflict = payload("p64-existing-conflict", [
      report("p64-existing-report", "2025-03-01T00:00:00.000Z", [item("existing", { title: "Changed history" })]),
    ]);
    await expect(previewImport(conflict, ownerKey, repository)).rejects.toMatchObject({
      status: 409,
      code: "IDEMPOTENCY_CONFLICT",
    });
  });

  it("미리보기 뒤 추천 저장이나 payload 변경은 IMPORT_CHANGED로 거절한다", async () => {
    await addSource();
    const imported = payload("p64-changed-history", [
      report("p64-changed-history", "2025-04-01T00:00:00.000Z", [item("changed-history")]),
    ]);
    const preview = await previewImport(imported, ownerKey, repository);
    const liveItem = item("live-recommendation");
    await addMaterial(liveItem);
    await saveRecommendationRun({
      reportId: "p64-live-recommendation",
      generatedAt: "2026-09-08T00:00:00.000Z",
      topics: [{
        topicKey: "live-recommendation",
        title: "Live recommendation",
        careerQuestion: "What should I learn?",
        items: [{
          contentKey: liveItem.contentKey,
          summary: "Summary",
          reason: "Reason",
          careerValue: "current-work",
        }],
      }],
    }, ownerKey, repository);
    await expect(commitImport(commitRequest(imported, preview), ownerKey, repository)).rejects.toMatchObject({
      status: 409,
      code: "IMPORT_CHANGED",
    });

    const changedPayload = payload("p64-changed-payload", [
      report("p64-changed-payload", "2025-05-01T00:00:00.000Z", [item("changed-payload")]),
    ]);
    const changedPreview = await previewImport(changedPayload, ownerKey, repository);
    await expect(commitImport({
      ...commitRequest(changedPayload, changedPreview),
      reports: [report("p64-changed-payload", "2025-05-01T00:00:00.000Z", [
        item("changed-payload", { title: "Changed after preview" }),
      ])],
    }, ownerKey, repository)).rejects.toMatchObject({ status: 409, code: "IMPORT_CHANGED" });
  });

  it("동시 commit과 응답 유실 재전송은 영수증 하나와 원래 응답을 공유한다", async () => {
    await addSource();
    const input = payload("p64-concurrent", [
      report("p64-concurrent", "2025-06-01T00:00:00.000Z", [item("concurrent")]),
    ]);
    const preview = await previewImport(input, ownerKey, repository);
    const request = commitRequest(input, preview);
    const results = await Promise.all([
      commitImport(request, ownerKey, repository),
      commitImport(request, ownerKey, concurrentRepository),
    ]);
    expect(results[0]).toEqual(results[1]);
    await expect(commitImport(request, ownerKey, repository)).resolves.toEqual(results[0]);
    await expect(commitImport({
      ...request,
      reports: [report("p64-concurrent", "2025-06-01T00:00:00.000Z", [
        item("concurrent", { title: "Different replay body" }),
      ])],
    }, ownerKey, repository)).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_CONFLICT" });
    expect(await fixture!.db.select().from(studyRequestReceipts).where(
      and(eq(studyRequestReceipts.operation, "import"), eq(studyRequestReceipts.requestKey, input.importKey)),
    )).toHaveLength(1);
    expect((await repository.getRecommendationHistory(ownerKey)).historyVersion).toBe(1);
  });

  it("중간 snapshot 저장 실패는 모든 변경을 rollback한다", async () => {
    await addSource();
    const first = item("rollback-first");
    const second = item("rollback-second");
    await addMaterial(second);
    const invalidSecond = { ...second, summary: "x".repeat(301) } as ImportItem;
    const input = payload("p64-rollback", [report(
      "p64-rollback",
      "2025-07-01T00:00:00.000Z",
      [],
      {
        topics: [
          { topicKey: "rollback-first", title: "First", careerQuestion: null, items: [first] },
          { topicKey: "rollback-second", title: "Second", careerQuestion: null, items: [invalidSecond] },
        ],
      },
    )]);
    const preview = await previewImport(input, ownerKey, repository);
    await expect(commitImport(commitRequest(input, preview), ownerKey, repository)).rejects.toMatchObject({
      status: 503,
      code: "UNAVAILABLE",
    });
    expect(await fixture!.db.select().from(studyRecommendationRuns).where(eq(studyRecommendationRuns.reportId, "p64-rollback"))).toHaveLength(0);
    expect(await fixture!.db.select().from(studyMaterials).where(eq(studyMaterials.contentKey, first.contentKey))).toHaveLength(0);
    expect(await fixture!.db.select().from(studyRecommendationTopics)).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ topicKey: "rollback-first" }),
    ]));
    expect(await fixture!.db.select().from(studyRecommendedMaterials).where(eq(studyRecommendedMaterials.ownerKey, ownerKey))).toHaveLength(0);
    expect(await fixture!.db.select().from(studyRequestReceipts).where(eq(studyRequestReceipts.requestKey, "p64-rollback"))).toHaveLength(0);
    expect(await repository.getRecommendationHistory(ownerKey)).toEqual({ historyVersion: 0, recentTopicKeys: [] });
  });

  it("오래된 import는 이력 버전만 올리고 최신 포인터를 되돌리지 않는다", async () => {
    await addSource();
    const recent = payload("p64-latest-recent", [
      report("p64-latest-recent", "2025-12-01T00:00:00.000Z", [item("latest-recent")]),
    ]);
    const recentPreview = await previewImport(recent, ownerKey, repository);
    await commitImport(commitRequest(recent, recentPreview), ownerKey, repository);
    const old = payload("p64-latest-old", [
      report("p64-latest-old", "2024-01-01T00:00:00.000Z", [item("latest-old")]),
    ]);
    const oldPreview = await previewImport(old, ownerKey, repository);
    await commitImport(commitRequest(old, oldPreview), ownerKey, repository);
    expect(await repository.getRecommendationHistory(ownerKey)).toEqual({
      historyVersion: 2,
      recentTopicKeys: ["topic-p64-latest-recent"],
    });
  });
});
