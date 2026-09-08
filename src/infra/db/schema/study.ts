import {
  boolean,
  customType,
  datetime,
  foreignKey,
  index,
  int,
  json,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const binaryKey = customType<{
  data: string;
  driverData: string;
  config: { length: number };
  configRequired: true;
}>({
  dataType: ({ length }) =>
    `varchar(${length}) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`,
});
const binaryHash = customType<{ data: string; driverData: string }>({
  dataType: () => "char(64) CHARACTER SET ascii COLLATE ascii_bin",
});
const studyDate = (name: string) => datetime(name, { mode: "date", fsp: 3 });
const unsignedInt = (name: string) => int(name, { unsigned: true });

export const studySources = mysqlTable("study_sources", {
  sourceKey: binaryKey("source_key", { length: 128 }).primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  category: varchar("category", { length: 16 }).notNull(),
  url: varchar("url", { length: 2048 }),
  feedUrl: varchar("feed_url", { length: 2048 }),
  adapter: varchar("adapter", { length: 16 }).notNull(),
  enabled: boolean("enabled").notNull(),
  version: unsignedInt("version").notNull(),
  updatedAt: studyDate("updated_at").notNull(),
});

export const studySourceCursors = mysqlTable(
  "study_source_cursors",
  {
    sourceKey: binaryKey("source_key", { length: 128 }).notNull(),
    mode: varchar("mode", { length: 8 }).notNull(),
    cursor: json("cursor").$type<Record<string, unknown> | null>(),
    version: unsignedInt("version").notNull(),
    updatedAt: studyDate("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceKey, table.mode] }),
    foreignKey({
      name: "study_cursors_source_fk",
      columns: [table.sourceKey],
      foreignColumns: [studySources.sourceKey],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
  ],
);

export const studyMaterials = mysqlTable(
  "study_materials",
  {
    id: unsignedInt("id").primaryKey().autoincrement(),
    contentKey: binaryKey("content_key", { length: 191 }).notNull(),
    canonicalUrl: varchar("canonical_url", { length: 2048 }).notNull(),
    url: varchar("url", { length: 2048 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    published: varchar("published", { length: 128 }).notNull(),
    publishedAt: studyDate("published_at"),
    excerpt: text("excerpt"),
    kind: varchar("kind", { length: 16 }).notNull(),
    collectedAt: studyDate("collected_at").notNull(),
    createdAt: studyDate("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("study_materials_content_key_unique").on(table.contentKey),
    index("study_materials_published_at_id_idx").on(table.publishedAt, table.id),
  ],
);

export const studyMaterialSources = mysqlTable(
  "study_material_sources",
  {
    materialId: unsignedInt("material_id").notNull(),
    sourceKey: binaryKey("source_key", { length: 128 }).notNull(),
    collectedAt: studyDate("collected_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.materialId, table.sourceKey] }),
    foreignKey({
      name: "study_material_sources_material_fk",
      columns: [table.materialId],
      foreignColumns: [studyMaterials.id],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
    foreignKey({
      name: "study_material_sources_source_fk",
      columns: [table.sourceKey],
      foreignColumns: [studySources.sourceKey],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
    index("study_material_sources_source_material_idx").on(
      table.sourceKey,
      table.materialId,
    ),
  ],
);

export const studyMaterialTags = mysqlTable(
  "study_material_tags",
  {
    materialId: unsignedInt("material_id").notNull(),
    tag: varchar("tag", { length: 50 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.materialId, table.tag] }),
    foreignKey({
      name: "study_material_tags_material_fk",
      columns: [table.materialId],
      foreignColumns: [studyMaterials.id],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
  ],
);

export const studyMaterialStates = mysqlTable(
  "study_material_states",
  {
    ownerKey: binaryKey("owner_key", { length: 128 }).notNull(),
    materialId: unsignedInt("material_id").notNull(),
    starred: boolean("starred").notNull(),
    read: boolean("read").notNull(),
    note: text("note").notNull(),
    version: unsignedInt("version").notNull(),
    updatedAt: studyDate("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerKey, table.materialId] }),
    foreignKey({
      name: "study_material_states_material_fk",
      columns: [table.materialId],
      foreignColumns: [studyMaterials.id],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
  ],
);

export const studyRecommendationRuns = mysqlTable(
  "study_recommendation_runs",
  {
    id: unsignedInt("id").primaryKey().autoincrement(),
    reportId: binaryKey("report_id", { length: 128 }).notNull(),
    generatedAt: studyDate("generated_at").notNull(),
    committedAt: studyDate("committed_at").notNull(),
    requestHash: binaryHash("request_hash").notNull(),
    historyVersion: unsignedInt("history_version").notNull(),
    origin: varchar("origin", { length: 8 }).notNull(),
  },
  (table) => [
    uniqueIndex("study_recommendation_runs_report_id_unique").on(table.reportId),
  ],
);

export const studyRecommendationControl = mysqlTable(
  "study_recommendation_control",
  {
    ownerKey: binaryKey("owner_key", { length: 128 }).primaryKey(),
    historyVersion: unsignedInt("history_version").notNull(),
    latestRunId: unsignedInt("latest_run_id"),
  },
  (table) => [
    foreignKey({
      name: "study_control_latest_run_fk",
      columns: [table.latestRunId],
      foreignColumns: [studyRecommendationRuns.id],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
  ],
);

export const studyRecommendationTopics = mysqlTable(
  "study_recommendation_topics",
  {
    id: unsignedInt("id").primaryKey().autoincrement(),
    runId: unsignedInt("run_id").notNull(),
    position: unsignedInt("position").notNull(),
    topicKey: binaryKey("topic_key", { length: 128 }).notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    careerQuestion: varchar("career_question", { length: 300 }),
  },
  (table) => [
    uniqueIndex("study_recommendation_topics_id_run_unique").on(
      table.id,
      table.runId,
    ),
    uniqueIndex("study_recommendation_topics_run_key_unique").on(
      table.runId,
      table.topicKey,
    ),
    uniqueIndex("study_recommendation_topics_run_position_unique").on(
      table.runId,
      table.position,
    ),
    foreignKey({
      name: "study_topics_run_fk",
      columns: [table.runId],
      foreignColumns: [studyRecommendationRuns.id],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
  ],
);

export const studyRecommendationItems = mysqlTable(
  "study_recommendation_items",
  {
    id: unsignedInt("id").primaryKey().autoincrement(),
    runId: unsignedInt("run_id").notNull(),
    topicId: unsignedInt("topic_id").notNull(),
    position: unsignedInt("position").notNull(),
    materialId: unsignedInt("material_id").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    canonicalUrl: varchar("canonical_url", { length: 2048 }).notNull(),
    summary: varchar("summary", { length: 300 }),
    reason: varchar("reason", { length: 300 }),
    careerValue: varchar("career_value", { length: 32 }),
  },
  (table) => [
    foreignKey({
      name: "study_recommendation_items_topic_run_fk",
      columns: [table.topicId, table.runId],
      foreignColumns: [studyRecommendationTopics.id, studyRecommendationTopics.runId],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
    foreignKey({
      name: "study_items_run_fk",
      columns: [table.runId],
      foreignColumns: [studyRecommendationRuns.id],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
    foreignKey({
      name: "study_items_material_fk",
      columns: [table.materialId],
      foreignColumns: [studyMaterials.id],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
    uniqueIndex("study_recommendation_items_run_material_unique").on(
      table.runId,
      table.materialId,
    ),
    uniqueIndex("study_recommendation_items_topic_position_unique").on(
      table.topicId,
      table.position,
    ),
  ],
);

export const studyRecommendedMaterials = mysqlTable(
  "study_recommended_materials",
  {
    ownerKey: binaryKey("owner_key", { length: 128 }).notNull(),
    materialId: unsignedInt("material_id").notNull(),
    firstRunId: unsignedInt("first_run_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerKey, table.materialId] }),
    foreignKey({
      name: "study_recommended_material_fk",
      columns: [table.materialId],
      foreignColumns: [studyMaterials.id],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
    foreignKey({
      name: "study_recommended_first_run_fk",
      columns: [table.firstRunId],
      foreignColumns: [studyRecommendationRuns.id],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
  ],
);

export const studyPublications = mysqlTable(
  "study_publications",
  {
    id: unsignedInt("id").primaryKey().autoincrement(),
    runId: unsignedInt("run_id").notNull(),
    channel: binaryKey("channel", { length: 128 }).notNull(),
    publishedAt: studyDate("published_at").notNull(),
    externalId: binaryKey("external_id", { length: 128 }).notNull(),
    url: varchar("url", { length: 2048 }),
    requestHash: binaryHash("request_hash").notNull(),
  },
  (table) => [
    uniqueIndex("study_publications_run_channel_external_unique").on(
      table.runId,
      table.channel,
      table.externalId,
    ),
    foreignKey({
      name: "study_publications_run_fk",
      columns: [table.runId],
      foreignColumns: [studyRecommendationRuns.id],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
  ],
);

export const studyRequestReceipts = mysqlTable(
  "study_request_receipts",
  {
    operation: varchar("operation", { length: 16 }).notNull(),
    requestKey: binaryKey("request_key", { length: 128 }).notNull(),
    requestHash: binaryHash("request_hash").notNull(),
    response: json("response").$type<Record<string, unknown>>().notNull(),
    createdAt: studyDate("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.operation, table.requestKey] })],
);

export type StudySource = typeof studySources.$inferSelect;
export type NewStudySource = typeof studySources.$inferInsert;
export type StudySourceCursor = typeof studySourceCursors.$inferSelect;
export type NewStudySourceCursor = typeof studySourceCursors.$inferInsert;
export type StudyMaterial = typeof studyMaterials.$inferSelect;
export type NewStudyMaterial = typeof studyMaterials.$inferInsert;
export type StudyMaterialSource = typeof studyMaterialSources.$inferSelect;
export type NewStudyMaterialSource = typeof studyMaterialSources.$inferInsert;
export type StudyMaterialTag = typeof studyMaterialTags.$inferSelect;
export type NewStudyMaterialTag = typeof studyMaterialTags.$inferInsert;
export type StudyMaterialState = typeof studyMaterialStates.$inferSelect;
export type NewStudyMaterialState = typeof studyMaterialStates.$inferInsert;
export type StudyRecommendationControl = typeof studyRecommendationControl.$inferSelect;
export type NewStudyRecommendationControl = typeof studyRecommendationControl.$inferInsert;
export type StudyRecommendationRun = typeof studyRecommendationRuns.$inferSelect;
export type NewStudyRecommendationRun = typeof studyRecommendationRuns.$inferInsert;
export type StudyRecommendationTopic = typeof studyRecommendationTopics.$inferSelect;
export type NewStudyRecommendationTopic = typeof studyRecommendationTopics.$inferInsert;
export type StudyRecommendationItem = typeof studyRecommendationItems.$inferSelect;
export type NewStudyRecommendationItem = typeof studyRecommendationItems.$inferInsert;
export type StudyRecommendedMaterial = typeof studyRecommendedMaterials.$inferSelect;
export type NewStudyRecommendedMaterial = typeof studyRecommendedMaterials.$inferInsert;
export type StudyPublication = typeof studyPublications.$inferSelect;
export type NewStudyPublication = typeof studyPublications.$inferInsert;
export type StudyRequestReceipt = typeof studyRequestReceipts.$inferSelect;
export type NewStudyRequestReceipt = typeof studyRequestReceipts.$inferInsert;
