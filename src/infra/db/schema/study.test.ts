import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import type { RowDataPacket } from "mysql2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, migrateTestDatabase } from "../test-utils";
import {
  studyMaterialSources,
  studyMaterials,
  studyRecommendationControl,
  studyRecommendationItems,
  studyRecommendationRuns,
  studyRecommendationTopics,
  studySourceCursors,
  studySources,
} from "./study";

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("학습자료 MySQL 스키마", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
  const now = new Date("2026-09-08T01:02:03.456Z");
  const sourceKeys = ["schema-source", "schema-Source"];
  const contentKeys = ["youtube:SchemaVideo", "youtube:schemavideo"];

  beforeAll(async () => {
    fixture = await createTestDatabase();
    await migrateTestDatabase(fixture);
    const [applied] = await fixture.connection.query<RowDataPacket[]>(
      "SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id",
    );
    await migrateTestDatabase(fixture);
    const [repeated] = await fixture.connection.query<RowDataPacket[]>(
      "SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id",
    );
    expect(repeated).toEqual(applied);
  }, 30_000);

  afterAll(async () => {
    if (!fixture) return;
    const { db } = fixture;
    const materials = await db
      .select({ id: studyMaterials.id })
      .from(studyMaterials)
      .where(inArray(studyMaterials.contentKey, contentKeys));
    const materialIds = materials.map(({ id }) => id);
    const runs = await db
      .select({ id: studyRecommendationRuns.id })
      .from(studyRecommendationRuns)
      .where(inArray(studyRecommendationRuns.reportId, ["schema-run-1", "schema-run-2"]));
    const runIds = runs.map(({ id }) => id);
    try {
      if (runIds.length > 0) {
        await db.delete(studyRecommendationItems).where(inArray(studyRecommendationItems.runId, runIds));
        await db.delete(studyRecommendationControl).where(eq(studyRecommendationControl.ownerKey, "schema-owner"));
        await db.delete(studyRecommendationTopics).where(inArray(studyRecommendationTopics.runId, runIds));
        await db.delete(studyRecommendationRuns).where(inArray(studyRecommendationRuns.id, runIds));
      }
      if (materialIds.length > 0) {
        await db.delete(studyMaterialSources).where(inArray(studyMaterialSources.materialId, materialIds));
        await db.delete(studyMaterials).where(inArray(studyMaterials.id, materialIds));
      }
      await db.delete(studySourceCursors).where(inArray(studySourceCursors.sourceKey, sourceKeys));
      await db.delete(studySources).where(inArray(studySources.sourceKey, sourceKeys));
    } finally {
      await fixture.connection.end();
    }
  });

  it("study 테이블 13개와 unsigned ID·UTC DATETIME(3)·binary 키를 생성한다", async () => {
    const { connection } = fixture!;
    const [tables] = await connection.query<RowDataPacket[]>(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'study_%' ORDER BY TABLE_NAME",
    );
    expect(tables.map((table) => table.name)).toEqual([
      "study_material_sources",
      "study_material_states",
      "study_material_tags",
      "study_materials",
      "study_publications",
      "study_recommendation_control",
      "study_recommendation_items",
      "study_recommendation_runs",
      "study_recommendation_topics",
      "study_recommended_materials",
      "study_request_receipts",
      "study_source_cursors",
      "study_sources",
    ]);

    const [columns] = await connection.query<RowDataPacket[]>(
      "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, DATETIME_PRECISION, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'study_%'",
    );
    for (const column of columns) {
      if (column.COLUMN_NAME.endsWith("_at")) {
        expect(column.COLUMN_TYPE).toBe("datetime(3)");
        expect(column.DATETIME_PRECISION).toBe(3);
      }
      if (["source_key", "content_key", "owner_key", "report_id", "request_key", "topic_key"].includes(column.COLUMN_NAME)) {
        expect(column.COLLATION_NAME).toBe("utf8mb4_bin");
      }
      if (
        column.COLUMN_TYPE.startsWith("int") &&
        (column.COLUMN_NAME === "id" ||
          column.COLUMN_NAME.endsWith("_id") ||
          column.COLUMN_NAME === "version" ||
          column.COLUMN_NAME.endsWith("_version") ||
          column.COLUMN_NAME === "position")
      ) {
        expect(column.COLUMN_TYPE).toContain("unsigned");
      }
    }

    const [foreignKeys] = await connection.query<RowDataPacket[]>(
      "SELECT DELETE_RULE, UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'study_%'",
    );
    expect(foreignKeys).toHaveLength(13);
    expect(
      foreignKeys.every(
        (foreignKey) =>
          foreignKey.DELETE_RULE === "RESTRICT" && foreignKey.UPDATE_RULE === "RESTRICT",
      ),
    ).toBe(true);
  });

  it("생성 migration은 기존 테이블을 변경하지 않고 control seed도 만들지 않는다", async () => {
    const migration = await readFile(path.resolve("drizzle/0012_tired_luminals.sql"), "utf8");
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bINSERT\b/i);
    for (const statement of migration.matchAll(/ALTER TABLE `([^`]+)`/g)) {
      expect(statement[1]).toMatch(/^study_/);
    }
  });

  it("source cursor 복합 PK와 FK RESTRICT를 적용한다", async () => {
    const { db } = fixture!;
    await expect(
      db.insert(studySourceCursors).values({
        sourceKey: sourceKeys[0], mode: "recent", cursor: null, version: 0, updatedAt: now,
      }),
    ).rejects.toMatchObject({ cause: { code: "ER_NO_REFERENCED_ROW_2" } });

    await db.insert(studySources).values({
      sourceKey: sourceKeys[0], title: "Schema source", category: "techBlog",
      url: "https://example.com", feedUrl: null, adapter: "page", enabled: true,
      version: 0, updatedAt: now,
    });
    await db.insert(studySourceCursors).values([
      { sourceKey: sourceKeys[0], mode: "recent", cursor: null, version: 0, updatedAt: now },
      { sourceKey: sourceKeys[0], mode: "archive", cursor: null, version: 0, updatedAt: now },
    ]);
    await expect(
      db.insert(studySourceCursors).values({
        sourceKey: sourceKeys[0], mode: "recent", cursor: null, version: 0, updatedAt: now,
      }),
    ).rejects.toMatchObject({ cause: { code: "ER_DUP_ENTRY" } });
    await expect(db.delete(studySources).where(eq(studySources.sourceKey, sourceKeys[0]))).rejects.toMatchObject({
      cause: { code: "ER_ROW_IS_REFERENCED_2" },
    });
  });

  it("contentKey 대소문자를 구분하고 동일한 키 중복은 거절한다", async () => {
    const { db } = fixture!;
    const material = (contentKey: string) => ({
      contentKey,
      canonicalUrl: `https://www.youtube.com/watch?v=${contentKey.slice("youtube:".length)}`,
      url: `https://youtu.be/${contentKey.slice("youtube:".length)}`,
      title: "Schema material",
      published: "",
      publishedAt: null,
      excerpt: null,
      kind: "page-video",
      collectedAt: now,
      createdAt: now,
    });
    await db.insert(studyMaterials).values(contentKeys.map(material));
    await expect(db.insert(studyMaterials).values(material(contentKeys[0]))).rejects.toMatchObject({
      cause: { code: "ER_DUP_ENTRY" },
    });
    expect(
      await db.select().from(studyMaterials).where(inArray(studyMaterials.contentKey, contentKeys)),
    ).toHaveLength(2);
  });

  it("추천 item의 run과 topic이 일치해야 한다", async () => {
    const { db } = fixture!;
    const [material] = await db
      .select({ id: studyMaterials.id })
      .from(studyMaterials)
      .where(eq(studyMaterials.contentKey, contentKeys[0]));
    expect(material).toBeDefined();
    await db.insert(studyRecommendationRuns).values([
      {
        reportId: "schema-run-1", generatedAt: now, committedAt: now,
        requestHash: "a".repeat(64), historyVersion: 1, origin: "live",
      },
      {
        reportId: "schema-run-2", generatedAt: now, committedAt: now,
        requestHash: "b".repeat(64), historyVersion: 2, origin: "live",
      },
    ]);
    const runs = await db
      .select({ id: studyRecommendationRuns.id, reportId: studyRecommendationRuns.reportId })
      .from(studyRecommendationRuns)
      .where(inArray(studyRecommendationRuns.reportId, ["schema-run-1", "schema-run-2"]));
    const run1 = runs.find((run) => run.reportId === "schema-run-1")!;
    const run2 = runs.find((run) => run.reportId === "schema-run-2")!;
    await db.insert(studyRecommendationTopics).values({
      runId: run1.id, position: 0, topicKey: "schema-topic", title: "Schema topic",
      careerQuestion: null,
    });
    const [topic] = await db
      .select({ id: studyRecommendationTopics.id })
      .from(studyRecommendationTopics)
      .where(eq(studyRecommendationTopics.runId, run1.id));

    await expect(
      db.insert(studyRecommendationItems).values({
        runId: run2.id,
        topicId: topic.id,
        position: 0,
        materialId: material.id,
        title: "Mismatched snapshot",
        canonicalUrl: "https://www.youtube.com/watch?v=SchemaVideo",
        summary: "summary",
        reason: "reason",
        careerValue: "current-work",
      }),
    ).rejects.toMatchObject({ cause: { code: "ER_NO_REFERENCED_ROW_2" } });
  });
});
