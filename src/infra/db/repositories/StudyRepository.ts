import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  inArray,
  lt,
  lte,
  max,
  notExists,
  sql,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  studyMaterialSources,
  studyMaterialStates,
  studyMaterialTags,
  studyMaterials,
  studyPublications,
  studyRecommendationControl,
  studyRecommendationItems,
  studyRecommendationRuns,
  studyRecommendationTopics,
  studyRecommendedMaterials,
  studyRequestReceipts,
  studySourceCursors,
  studySources,
  type StudyMaterialState,
  type StudyRecommendationControl,
  type StudySource,
  type StudySourceCursor,
} from "../schema";
import type {
  CursorMode,
  CreateRecommendationRunInput,
  CreateRecommendationRunResult,
  IngestBatchInput,
  IngestBatchResult,
  MaterialKind,
  PublicationInput,
  PublicationResult,
  SourceAdapter,
  SourceCategory,
  UpdateMaterialStateRequest,
} from "@/lib/study/contracts";
import { BaseRepository } from "./BaseRepository";

type SourceValues = {
  sourceKey: string;
  title: string;
  category: SourceCategory;
  url: string | null;
  feedUrl: string | null;
  adapter: SourceAdapter;
  enabled: boolean;
  expectedVersion: number;
};

export type PutStudySourceResult =
  | { status: "success"; source: StudySource }
  | { status: "version_conflict" };

export type StudyMaterialFilters = {
  q?: string;
  sourceKey?: string;
  category?: SourceCategory;
  kind?: MaterialKind;
  starred?: boolean;
  read?: boolean;
  recommended?: boolean;
  publishedFrom?: Date;
  publishedTo?: Date;
};

export type StudyMaterialPageRequest = StudyMaterialFilters & {
  limit: number;
  maximumId: number;
  lastId?: number;
};

export type StudyMaterialRecord = {
  id: number;
  contentKey: string;
  canonicalUrl: string;
  title: string;
  publishedAt: Date | null;
  excerpt: string | null;
  kind: string;
  tags: string[];
  sources: Array<{
    sourceKey: string;
    sourceName: string;
    category: string;
  }>;
  state: {
    starred: boolean;
    read: boolean;
    note: string;
    version: number;
    updatedAt: Date | null;
  };
  previouslyRecommended: boolean;
};

export type StudyMaterialPage = {
  records: StudyMaterialRecord[];
  hasMore: boolean;
};

export type UpdateStudyMaterialStateResult =
  | { status: "success"; state: StudyMaterialState }
  | { status: "not_found" }
  | { status: "version_conflict" };

export type IngestStudyBatchResult =
  | { status: "success"; response: IngestBatchResult }
  | { status: "idempotency_conflict" }
  | { status: "not_found" }
  | { status: "source_disabled" }
  | { status: "version_conflict" };

export type StudyCandidateFilters = {
  sourceKey?: string;
  category?: SourceCategory;
  kind?: MaterialKind;
  publishedFrom?: Date;
  publishedTo?: Date;
};

export type StudyCandidatePageRequest = StudyCandidateFilters & {
  limit: number;
  maximumId: number;
  lastId?: number;
};

export type StudyCandidateRecord = {
  materialId: number;
  contentKey: string;
  canonicalUrl: string;
  sourceKey: string;
  sourceName: string;
  category: string;
  title: string;
  url: string;
  published: string;
  excerpt: string | null;
  kind: string;
  previouslyRecommended: boolean;
};

export type StudyCandidatePage = {
  records: StudyCandidateRecord[];
  hasMore: boolean;
};

export type SaveStudyRecommendationRunResult =
  | { status: "success"; response: CreateRecommendationRunResult }
  | { status: "idempotency_conflict" }
  | { status: "not_found" }
  | { status: "already_recommended" }
  | { status: "recent_topic_conflict" }
  | { status: "version_conflict" };

export type StudyRecommendationRunPage = {
  records: Array<{
    id: number;
    reportId: string;
    generatedAt: Date;
    topicCount: number;
  }>;
  hasMore: boolean;
};

export type StudyRecommendationRunRecord = {
  reportId: string;
  generatedAt: Date;
  topics: Array<{
    topicKey: string;
    title: string;
    careerQuestion: string | null;
    items: Array<{
      materialId: number;
      contentKey: string;
      title: string;
      canonicalUrl: string;
      summary: string | null;
      reason: string | null;
      careerValue: string | null;
      state: {
        starred: boolean;
        read: boolean;
        note: string;
        version: number;
        updatedAt: Date | null;
      };
    }>;
  }>;
  publications: Array<{
    publicationId: number;
    channel: string;
    publishedAt: Date;
    externalId: string;
    url: string | null;
  }>;
};

export type RecordStudyPublicationResult =
  | { status: "success"; response: PublicationResult }
  | { status: "idempotency_conflict" }
  | { status: "not_found" };

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return affectedRows(result[0]);
  }
  if (typeof result === "object" && result !== null && "affectedRows" in result) {
    const value = (result as { affectedRows?: unknown }).affectedRows;
    return typeof value === "number" ? value : 0;
  }
  return 0;
}

export function isDuplicateKeyError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current !== null; depth += 1) {
    if (typeof current !== "object") return false;
    const candidate = current as { code?: unknown; cause?: unknown };
    if (candidate.code === "ER_DUP_ENTRY") return true;
    current = candidate.cause;
  }
  return false;
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export class StudyRepository extends BaseRepository {
  async ensureRecommendationControl(ownerKey: string): Promise<StudyRecommendationControl> {
    await this.db
      .insert(studyRecommendationControl)
      .values({ ownerKey, historyVersion: 0, latestRunId: null })
      .onDuplicateKeyUpdate({
        set: { ownerKey: sql`${studyRecommendationControl.ownerKey}` },
      });

    const rows = await this.db
      .select()
      .from(studyRecommendationControl)
      .where(eq(studyRecommendationControl.ownerKey, ownerKey))
      .limit(1);
    const control = rows[0];
    if (!control) throw new Error("추천 control 행을 생성하지 못했습니다.");
    return control;
  }

  async getRecommendationHistory(
    ownerKey: string,
  ): Promise<{ historyVersion: number; recentTopicKeys: string[] }> {
    await this.ensureRecommendationControl(ownerKey);
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          historyVersion: studyRecommendationControl.historyVersion,
          latestRunId: studyRecommendationControl.latestRunId,
        })
        .from(studyRecommendationControl)
        .where(eq(studyRecommendationControl.ownerKey, ownerKey))
        .limit(1);
      const control = rows[0];
      if (!control) throw new Error("추천 control 행을 조회하지 못했습니다.");
      if (control.latestRunId === null) {
        return { historyVersion: control.historyVersion, recentTopicKeys: [] };
      }
      const topics = await tx
        .select({ topicKey: studyRecommendationTopics.topicKey })
        .from(studyRecommendationTopics)
        .where(eq(studyRecommendationTopics.runId, control.latestRunId))
        .orderBy(asc(studyRecommendationTopics.position));
      return {
        historyVersion: control.historyVersion,
        recentTopicKeys: topics.map(({ topicKey }) => topicKey),
      };
    });
  }

  async listCandidates(
    input: StudyCandidatePageRequest,
    ownerKey: string,
  ): Promise<StudyCandidatePage> {
    if (input.maximumId === 0) return { records: [], hasMore: false };
    const sourceMatch = this.candidateSourceConditions(input);
    const conditions: SQL[] = [
      lte(studyMaterials.id, input.maximumId),
      exists(
        this.db
          .select({ value: sql`1` })
          .from(studyMaterialSources)
          .innerJoin(studySources, eq(studySources.sourceKey, studyMaterialSources.sourceKey))
          .where(and(eq(studyMaterialSources.materialId, studyMaterials.id), ...sourceMatch)),
      ),
    ];
    if (input.lastId !== undefined) conditions.push(lt(studyMaterials.id, input.lastId));
    if (input.kind !== undefined) conditions.push(eq(studyMaterials.kind, input.kind));
    if (input.publishedFrom !== undefined) conditions.push(gte(studyMaterials.publishedAt, input.publishedFrom));
    if (input.publishedTo !== undefined) conditions.push(lt(studyMaterials.publishedAt, input.publishedTo));
    if (input.publishedFrom !== undefined || input.publishedTo !== undefined) {
      conditions.push(sql`${studyMaterials.publishedAt} IS NOT NULL`);
    }
    const recommendationExists = sql<number>`EXISTS (
      SELECT 1 FROM ${studyRecommendedMaterials}
      WHERE ${studyRecommendedMaterials.ownerKey} = ${ownerKey}
        AND ${studyRecommendedMaterials.materialId} = ${studyMaterials.id}
    )`;
    const rows = await this.db
      .select({
        materialId: studyMaterials.id,
        contentKey: studyMaterials.contentKey,
        canonicalUrl: studyMaterials.canonicalUrl,
        title: studyMaterials.title,
        url: studyMaterials.url,
        published: studyMaterials.published,
        excerpt: studyMaterials.excerpt,
        kind: studyMaterials.kind,
        previouslyRecommended: recommendationExists,
      })
      .from(studyMaterials)
      .where(and(...conditions))
      .orderBy(desc(studyMaterials.id))
      .limit(input.limit + 1);
    const hasMore = rows.length > input.limit;
    const pageRows = rows.slice(0, input.limit);
    if (pageRows.length === 0) return { records: [], hasMore };

    const sourceRows = await this.db
      .select({
        materialId: studyMaterialSources.materialId,
        sourceKey: studySources.sourceKey,
        sourceName: studySources.title,
        category: studySources.category,
      })
      .from(studyMaterialSources)
      .innerJoin(studySources, eq(studySources.sourceKey, studyMaterialSources.sourceKey))
      .where(
        and(
          inArray(studyMaterialSources.materialId, pageRows.map(({ materialId }) => materialId)),
          ...sourceMatch,
        ),
      )
      .orderBy(asc(studyMaterialSources.materialId), asc(studySources.sourceKey));
    const selectedSources = new Map<number, (typeof sourceRows)[number]>();
    for (const row of sourceRows) {
      if (!selectedSources.has(row.materialId)) selectedSources.set(row.materialId, row);
    }
    return {
      hasMore,
      records: pageRows.map((row) => {
        const source = selectedSources.get(row.materialId);
        if (!source) throw new Error("후보의 활성 소스를 조회하지 못했습니다.");
        return {
          ...row,
          sourceKey: source.sourceKey,
          sourceName: source.sourceName,
          category: source.category,
          previouslyRecommended: Boolean(row.previouslyRecommended),
        };
      }),
    };
  }

  async saveRecommendationRun(
    input: CreateRecommendationRunInput,
    ownerKey: string,
    requestHash: string,
    now = new Date(),
  ): Promise<SaveStudyRecommendationRunResult> {
    await this.ensureRecommendationControl(ownerKey);
    try {
      return await this.db.transaction(async (tx) => {
        const controls = await tx
          .select()
          .from(studyRecommendationControl)
          .where(eq(studyRecommendationControl.ownerKey, ownerKey))
          .limit(1)
          .for("update");
        const control = controls[0];
        if (!control) throw new Error("추천 control 행을 잠그지 못했습니다.");

        const existingRuns = await tx
          .select({ requestHash: studyRecommendationRuns.requestHash, historyVersion: studyRecommendationRuns.historyVersion })
          .from(studyRecommendationRuns)
          .where(eq(studyRecommendationRuns.reportId, input.reportId))
          .limit(1);
        const existing = existingRuns[0];
        if (existing) {
          return existing.requestHash === requestHash
            ? { status: "success", response: { reportId: input.reportId, historyVersion: existing.historyVersion } }
            : { status: "idempotency_conflict" };
        }
        if (control.historyVersion === 0xffffffff) return { status: "version_conflict" };

        const topicKeys = input.topics.map(({ topicKey }) => topicKey);
        if (control.latestRunId !== null && topicKeys.length > 0) {
          const recentTopics = await tx
            .select({ topicKey: studyRecommendationTopics.topicKey })
            .from(studyRecommendationTopics)
            .where(
              and(
                eq(studyRecommendationTopics.runId, control.latestRunId),
                inArray(studyRecommendationTopics.topicKey, topicKeys),
              ),
            )
            .limit(1);
          if (recentTopics[0]) return { status: "recent_topic_conflict" };
        }

        const contentKeys = input.topics.flatMap(({ items }) => items.map(({ contentKey }) => contentKey));
        const materials = contentKeys.length === 0
          ? []
          : await tx
            .select({
              id: studyMaterials.id,
              contentKey: studyMaterials.contentKey,
              title: studyMaterials.title,
              canonicalUrl: studyMaterials.canonicalUrl,
            })
            .from(studyMaterials)
            .where(inArray(studyMaterials.contentKey, contentKeys));
        if (materials.length !== contentKeys.length) return { status: "not_found" };
        if (materials.length > 0) {
          const recommended = await tx
            .select({ materialId: studyRecommendedMaterials.materialId })
            .from(studyRecommendedMaterials)
            .where(
              and(
                eq(studyRecommendedMaterials.ownerKey, ownerKey),
                inArray(studyRecommendedMaterials.materialId, materials.map(({ id }) => id)),
              ),
            )
            .limit(1);
          if (recommended[0]) return { status: "already_recommended" };
        }

        const historyVersion = control.historyVersion + 1;
        const insertRun = await tx.insert(studyRecommendationRuns).values({
          reportId: input.reportId,
          generatedAt: new Date(input.generatedAt),
          committedAt: now,
          requestHash,
          historyVersion,
          origin: "live",
        });
        const runId = Number(insertRun[0].insertId);
        const materialsByKey = new Map(materials.map((material) => [material.contentKey, material]));
        for (const [topicPosition, topic] of input.topics.entries()) {
          const insertTopic = await tx.insert(studyRecommendationTopics).values({
            runId,
            position: topicPosition,
            topicKey: topic.topicKey,
            title: topic.title,
            careerQuestion: topic.careerQuestion,
          });
          const topicId = Number(insertTopic[0].insertId);
          await tx.insert(studyRecommendationItems).values(
            topic.items.map((item, position) => {
              const material = materialsByKey.get(item.contentKey);
              if (!material) throw new Error("추천 자료 snapshot을 만들 수 없습니다.");
              return {
                runId,
                topicId,
                position,
                materialId: material.id,
                title: material.title,
                canonicalUrl: material.canonicalUrl,
                summary: item.summary,
                reason: item.reason,
                careerValue: item.careerValue,
              };
            }),
          );
        }
        if (materials.length > 0) {
          await tx.insert(studyRecommendedMaterials).values(
            materials.map(({ id }) => ({ ownerKey, materialId: id, firstRunId: runId })),
          );
        }
        await tx
          .update(studyRecommendationControl)
          .set({ historyVersion, latestRunId: runId })
          .where(eq(studyRecommendationControl.ownerKey, ownerKey));
        return { status: "success", response: { reportId: input.reportId, historyVersion } };
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const existing = await this.db
        .select({ requestHash: studyRecommendationRuns.requestHash, historyVersion: studyRecommendationRuns.historyVersion })
        .from(studyRecommendationRuns)
        .where(eq(studyRecommendationRuns.reportId, input.reportId))
        .limit(1);
      if (!existing[0]) throw error;
      return existing[0].requestHash === requestHash
        ? { status: "success", response: { reportId: input.reportId, historyVersion: existing[0].historyVersion } }
        : { status: "idempotency_conflict" };
    }
  }

  async getMaximumRecommendationRunId(): Promise<number> {
    const rows = await this.db.select({ value: max(studyRecommendationRuns.id) }).from(studyRecommendationRuns);
    return Number(rows[0]?.value ?? 0);
  }

  async listRecommendationRuns(input: {
    limit: number;
    maximumId: number;
    lastId?: number;
  }): Promise<StudyRecommendationRunPage> {
    if (input.maximumId === 0) return { records: [], hasMore: false };
    const conditions: SQL[] = [lte(studyRecommendationRuns.id, input.maximumId)];
    if (input.lastId !== undefined) conditions.push(lt(studyRecommendationRuns.id, input.lastId));
    const rows = await this.db
      .select({
        id: studyRecommendationRuns.id,
        reportId: studyRecommendationRuns.reportId,
        generatedAt: studyRecommendationRuns.generatedAt,
        topicCount: sql<number>`COUNT(${studyRecommendationTopics.id})`,
      })
      .from(studyRecommendationRuns)
      .leftJoin(studyRecommendationTopics, eq(studyRecommendationTopics.runId, studyRecommendationRuns.id))
      .where(and(...conditions))
      .groupBy(studyRecommendationRuns.id, studyRecommendationRuns.reportId, studyRecommendationRuns.generatedAt)
      .orderBy(desc(studyRecommendationRuns.id))
      .limit(input.limit + 1);
    return {
      hasMore: rows.length > input.limit,
      records: rows.slice(0, input.limit).map((row) => ({ ...row, topicCount: Number(row.topicCount) })),
    };
  }

  async getRecommendationRun(
    reportId: string,
    ownerKey: string,
  ): Promise<StudyRecommendationRunRecord | null> {
    const runs = await this.db
      .select({ id: studyRecommendationRuns.id, reportId: studyRecommendationRuns.reportId, generatedAt: studyRecommendationRuns.generatedAt })
      .from(studyRecommendationRuns)
      .where(eq(studyRecommendationRuns.reportId, reportId))
      .limit(1);
    const run = runs[0];
    if (!run) return null;
    const [topics, items, publications] = await Promise.all([
      this.db
        .select()
        .from(studyRecommendationTopics)
        .where(eq(studyRecommendationTopics.runId, run.id))
        .orderBy(asc(studyRecommendationTopics.position)),
      this.db
        .select({
          topicId: studyRecommendationItems.topicId,
          position: studyRecommendationItems.position,
          materialId: studyRecommendationItems.materialId,
          contentKey: studyMaterials.contentKey,
          title: studyRecommendationItems.title,
          canonicalUrl: studyRecommendationItems.canonicalUrl,
          summary: studyRecommendationItems.summary,
          reason: studyRecommendationItems.reason,
          careerValue: studyRecommendationItems.careerValue,
          starred: studyMaterialStates.starred,
          read: studyMaterialStates.read,
          note: studyMaterialStates.note,
          stateVersion: studyMaterialStates.version,
          stateUpdatedAt: studyMaterialStates.updatedAt,
        })
        .from(studyRecommendationItems)
        .innerJoin(studyMaterials, eq(studyMaterials.id, studyRecommendationItems.materialId))
        .leftJoin(
          studyMaterialStates,
          and(
            eq(studyMaterialStates.ownerKey, ownerKey),
            eq(studyMaterialStates.materialId, studyRecommendationItems.materialId),
          ),
        )
        .where(eq(studyRecommendationItems.runId, run.id))
        .orderBy(asc(studyRecommendationItems.topicId), asc(studyRecommendationItems.position)),
      this.db
        .select({
          publicationId: studyPublications.id,
          channel: studyPublications.channel,
          publishedAt: studyPublications.publishedAt,
          externalId: studyPublications.externalId,
          url: studyPublications.url,
        })
        .from(studyPublications)
        .where(eq(studyPublications.runId, run.id))
        .orderBy(asc(studyPublications.id)),
    ]);
    const itemsByTopic = new Map<number, StudyRecommendationRunRecord["topics"][number]["items"]>();
    for (const item of items) {
      const values = itemsByTopic.get(item.topicId) ?? [];
      values.push({
        materialId: item.materialId,
        contentKey: item.contentKey,
        title: item.title,
        canonicalUrl: item.canonicalUrl,
        summary: item.summary,
        reason: item.reason,
        careerValue: item.careerValue,
        state: {
          starred: item.starred ?? false,
          read: item.read ?? false,
          note: item.note ?? "",
          version: item.stateVersion ?? 0,
          updatedAt: item.stateUpdatedAt ?? null,
        },
      });
      itemsByTopic.set(item.topicId, values);
    }
    return {
      reportId: run.reportId,
      generatedAt: run.generatedAt,
      topics: topics.map((topic) => ({
        topicKey: topic.topicKey,
        title: topic.title,
        careerQuestion: topic.careerQuestion,
        items: itemsByTopic.get(topic.id) ?? [],
      })),
      publications,
    };
  }

  async recordPublication(
    input: PublicationInput,
    requestHash: string,
    publicationHash: string,
    now = new Date(),
  ): Promise<RecordStudyPublicationResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const receiptRows = await tx
          .select({ requestHash: studyRequestReceipts.requestHash, response: studyRequestReceipts.response })
          .from(studyRequestReceipts)
          .where(
            and(
              eq(studyRequestReceipts.operation, "publication"),
              eq(studyRequestReceipts.requestKey, input.idempotencyKey),
            ),
          )
          .limit(1);
        const receipt = receiptRows[0];
        if (receipt) {
          return receipt.requestHash === requestHash
            ? { status: "success", response: receipt.response as PublicationResult }
            : { status: "idempotency_conflict" };
        }

        const runs = await tx
          .select({ id: studyRecommendationRuns.id })
          .from(studyRecommendationRuns)
          .where(eq(studyRecommendationRuns.reportId, input.reportId))
          .limit(1)
          .for("update");
        const run = runs[0];
        if (!run) return { status: "not_found" };

        const receiptAfterLock = await tx
          .select({ requestHash: studyRequestReceipts.requestHash, response: studyRequestReceipts.response })
          .from(studyRequestReceipts)
          .where(
            and(
              eq(studyRequestReceipts.operation, "publication"),
              eq(studyRequestReceipts.requestKey, input.idempotencyKey),
            ),
          )
          .limit(1)
          .for("update");
        if (receiptAfterLock[0]) {
          return receiptAfterLock[0].requestHash === requestHash
            ? { status: "success", response: receiptAfterLock[0].response as PublicationResult }
            : { status: "idempotency_conflict" };
        }

        const existingRows = await tx
          .select({ id: studyPublications.id, requestHash: studyPublications.requestHash })
          .from(studyPublications)
          .where(
            and(
              eq(studyPublications.runId, run.id),
              eq(studyPublications.channel, input.channel),
              eq(studyPublications.externalId, input.externalId),
            ),
          )
          .limit(1)
          .for("update");
        const existing = existingRows[0];
        if (existing && existing.requestHash !== publicationHash) {
          return { status: "idempotency_conflict" };
        }
        let publicationId = existing?.id;
        if (publicationId === undefined) {
          const inserted = await tx.insert(studyPublications).values({
            runId: run.id,
            channel: input.channel,
            publishedAt: new Date(input.publishedAt),
            externalId: input.externalId,
            url: input.url,
            requestHash: publicationHash,
          });
          publicationId = Number(inserted[0].insertId);
        }
        const response: PublicationResult = { publicationId };
        await tx.insert(studyRequestReceipts).values({
          operation: "publication",
          requestKey: input.idempotencyKey,
          requestHash,
          response,
          createdAt: now,
        });
        return { status: "success", response };
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const receipts = await this.db
        .select({ requestHash: studyRequestReceipts.requestHash, response: studyRequestReceipts.response })
        .from(studyRequestReceipts)
        .where(
          and(
            eq(studyRequestReceipts.operation, "publication"),
            eq(studyRequestReceipts.requestKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (!receipts[0]) throw error;
      return receipts[0].requestHash === requestHash
        ? { status: "success", response: receipts[0].response as PublicationResult }
        : { status: "idempotency_conflict" };
    }
  }

  async putSource(input: SourceValues, now = new Date()): Promise<PutStudySourceResult> {
    return this.db.transaction(async (tx) => {
      const nextVersion = input.expectedVersion + 1;
      if (nextVersion > 0xffffffff) return { status: "version_conflict" };

      if (input.expectedVersion === 0) {
        try {
          await tx.insert(studySources).values({
            sourceKey: input.sourceKey,
            title: input.title,
            category: input.category,
            url: input.url,
            feedUrl: input.feedUrl,
            adapter: input.adapter,
            enabled: input.enabled,
            version: nextVersion,
            updatedAt: now,
          });
          await tx.insert(studySourceCursors).values([
            { sourceKey: input.sourceKey, mode: "recent", cursor: null, version: 0, updatedAt: now },
            { sourceKey: input.sourceKey, mode: "archive", cursor: null, version: 0, updatedAt: now },
          ]);
        } catch (error) {
          if (isDuplicateKeyError(error)) return { status: "version_conflict" };
          throw error;
        }
      } else {
        const updateResult = await tx
          .update(studySources)
          .set({
            title: input.title,
            category: input.category,
            url: input.url,
            feedUrl: input.feedUrl,
            adapter: input.adapter,
            enabled: input.enabled,
            version: nextVersion,
            updatedAt: now,
          })
          .where(
            and(
              eq(studySources.sourceKey, input.sourceKey),
              eq(studySources.version, input.expectedVersion),
            ),
          );
        if (affectedRows(updateResult) !== 1) return { status: "version_conflict" };
      }

      return {
        status: "success",
        source: {
          sourceKey: input.sourceKey,
          title: input.title,
          category: input.category,
          url: input.url,
          feedUrl: input.feedUrl,
          adapter: input.adapter,
          enabled: input.enabled,
          version: nextVersion,
          updatedAt: now,
        },
      };
    });
  }

  async listSources(): Promise<StudySource[]> {
    return this.db.select().from(studySources).orderBy(asc(studySources.sourceKey));
  }

  async getSourceCursor(
    sourceKey: string,
    mode: CursorMode,
  ): Promise<{ source: StudySource; cursor: StudySourceCursor | null } | null> {
    const sourceRows = await this.db
      .select()
      .from(studySources)
      .where(eq(studySources.sourceKey, sourceKey))
      .limit(1);
    const source = sourceRows[0];
    if (!source) return null;
    const cursorRows = await this.db
      .select()
      .from(studySourceCursors)
      .where(
        and(
          eq(studySourceCursors.sourceKey, sourceKey),
          eq(studySourceCursors.mode, mode),
        ),
      )
      .limit(1);
    return { source, cursor: cursorRows[0] ?? null };
  }

  async getIngestionReceipt(
    requestKey: string,
  ): Promise<{ requestHash: string; response: Record<string, unknown> } | null> {
    const rows = await this.db
      .select({
        requestHash: studyRequestReceipts.requestHash,
        response: studyRequestReceipts.response,
      })
      .from(studyRequestReceipts)
      .where(
        and(
          eq(studyRequestReceipts.operation, "ingestion"),
          eq(studyRequestReceipts.requestKey, requestKey),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async ingestBatch(
    input: IngestBatchInput,
    requestHash: string,
    now = new Date(),
  ): Promise<IngestStudyBatchResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const lockedRows = await tx
          .select({
            enabled: studySources.enabled,
            version: studySourceCursors.version,
          })
          .from(studySourceCursors)
          .innerJoin(studySources, eq(studySources.sourceKey, studySourceCursors.sourceKey))
          .where(
            and(
              eq(studySourceCursors.sourceKey, input.sourceKey),
              eq(studySourceCursors.mode, input.mode),
            ),
          )
          .limit(1)
          .for("update");
        const locked = lockedRows[0];
        if (!locked) return { status: "not_found" };

        const receiptRows = await tx
          .select({
            requestHash: studyRequestReceipts.requestHash,
            response: studyRequestReceipts.response,
          })
          .from(studyRequestReceipts)
          .where(
            and(
              eq(studyRequestReceipts.operation, "ingestion"),
              eq(studyRequestReceipts.requestKey, input.idempotencyKey),
            ),
          )
          .limit(1);
        const receipt = receiptRows[0];
        if (receipt) {
          return receipt.requestHash === requestHash
            ? { status: "success", response: receipt.response as IngestBatchResult }
            : { status: "idempotency_conflict" };
        }
        if (!locked.enabled) return { status: "source_disabled" };
        if (locked.version !== input.expectedCursorVersion || locked.version === 0xffffffff) {
          return { status: "version_conflict" };
        }

        for (const item of [...input.items].sort((left, right) =>
          left.contentKey < right.contentKey ? -1 : left.contentKey > right.contentKey ? 1 : 0)) {
          const collectedAt = new Date(item.collectedAt);
          let inserted = false;
          try {
            await tx.insert(studyMaterials).values({
              contentKey: item.contentKey,
              canonicalUrl: item.canonicalUrl,
              url: item.url,
              title: item.title,
              published: item.published,
              publishedAt: item.publishedAt === null ? null : new Date(item.publishedAt),
              excerpt: item.excerpt,
              kind: item.kind,
              collectedAt,
              createdAt: now,
            });
            inserted = true;
          } catch (error) {
            if (!isDuplicateKeyError(error)) throw error;
          }

          const materialRows = await tx
            .select({ id: studyMaterials.id, collectedAt: studyMaterials.collectedAt })
            .from(studyMaterials)
            .where(eq(studyMaterials.contentKey, item.contentKey))
            .limit(1)
            .for("update");
          const material = materialRows[0];
          if (!material) throw new Error("수집 자료를 저장한 뒤 조회하지 못했습니다.");

          const shouldReplaceMetadata = !inserted && collectedAt > material.collectedAt;
          if (shouldReplaceMetadata) {
            await tx
              .update(studyMaterials)
              .set({
                canonicalUrl: item.canonicalUrl,
                url: item.url,
                title: item.title,
                published: item.published,
                publishedAt: item.publishedAt === null ? null : new Date(item.publishedAt),
                excerpt: item.excerpt,
                kind: item.kind,
                collectedAt,
              })
              .where(eq(studyMaterials.id, material.id));
            await tx.delete(studyMaterialTags).where(eq(studyMaterialTags.materialId, material.id));
          }
          if ((inserted || shouldReplaceMetadata) && item.tags.length > 0) {
            await tx.insert(studyMaterialTags).values(
              item.tags.map((tag) => ({ materialId: material.id, tag })),
            );
          }

          await tx
            .insert(studyMaterialSources)
            .values({ materialId: material.id, sourceKey: input.sourceKey, collectedAt })
            .onDuplicateKeyUpdate({
              set: {
                collectedAt: sql`GREATEST(${studyMaterialSources.collectedAt}, ${collectedAt})`,
              },
            });
        }

        const cursorVersion = locked.version + 1;
        await tx
          .update(studySourceCursors)
          .set({
            cursor: input.cursor as Record<string, unknown> | null,
            version: cursorVersion,
            updatedAt: now,
          })
          .where(
            and(
              eq(studySourceCursors.sourceKey, input.sourceKey),
              eq(studySourceCursors.mode, input.mode),
            ),
          );
        const response: IngestBatchResult = {
          idempotencyKey: input.idempotencyKey,
          acceptedCount: input.items.length,
          cursorVersion,
        };
        await tx.insert(studyRequestReceipts).values({
          operation: "ingestion",
          requestKey: input.idempotencyKey,
          requestHash,
          response,
          createdAt: now,
        });
        return { status: "success", response };
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const receipt = await this.getIngestionReceipt(input.idempotencyKey);
      if (!receipt) throw error;
      return receipt.requestHash === requestHash
        ? { status: "success", response: receipt.response as IngestBatchResult }
        : { status: "idempotency_conflict" };
    }
  }

  async getMaximumMaterialId(): Promise<number> {
    const rows = await this.db.select({ value: max(studyMaterials.id) }).from(studyMaterials);
    return Number(rows[0]?.value ?? 0);
  }

  async listMaterials(input: StudyMaterialPageRequest, ownerKey: string): Promise<StudyMaterialPage> {
    if (input.maximumId === 0) return { records: [], hasMore: false };
    const conditions = this.materialConditions(input, ownerKey);
    const recommendationExists = sql<number>`EXISTS (
      SELECT 1 FROM ${studyRecommendedMaterials}
      WHERE ${studyRecommendedMaterials.ownerKey} = ${ownerKey}
        AND ${studyRecommendedMaterials.materialId} = ${studyMaterials.id}
    )`;
    const rows = await this.db
      .select({
        id: studyMaterials.id,
        contentKey: studyMaterials.contentKey,
        canonicalUrl: studyMaterials.canonicalUrl,
        title: studyMaterials.title,
        publishedAt: studyMaterials.publishedAt,
        excerpt: studyMaterials.excerpt,
        kind: studyMaterials.kind,
        starred: studyMaterialStates.starred,
        read: studyMaterialStates.read,
        note: studyMaterialStates.note,
        stateVersion: studyMaterialStates.version,
        stateUpdatedAt: studyMaterialStates.updatedAt,
        previouslyRecommended: recommendationExists,
      })
      .from(studyMaterials)
      .leftJoin(
        studyMaterialStates,
        and(
          eq(studyMaterialStates.ownerKey, ownerKey),
          eq(studyMaterialStates.materialId, studyMaterials.id),
        ),
      )
      .where(and(...conditions))
      .orderBy(desc(studyMaterials.id))
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const pageRows = rows.slice(0, input.limit);
    const related = await this.getMaterialRelations(pageRows.map(({ id }) => id));
    return {
      hasMore,
      records: pageRows.map((row) => ({
        id: row.id,
        contentKey: row.contentKey,
        canonicalUrl: row.canonicalUrl,
        title: row.title,
        publishedAt: row.publishedAt,
        excerpt: row.excerpt,
        kind: row.kind,
        tags: related.tags.get(row.id) ?? [],
        sources: related.sources.get(row.id) ?? [],
        state: {
          starred: row.starred ?? false,
          read: row.read ?? false,
          note: row.note ?? "",
          version: row.stateVersion ?? 0,
          updatedAt: row.stateUpdatedAt ?? null,
        },
        previouslyRecommended: Boolean(row.previouslyRecommended),
      })),
    };
  }

  async getMaterial(id: number, ownerKey: string): Promise<StudyMaterialRecord | null> {
    const recommendationExists = sql<number>`EXISTS (
      SELECT 1 FROM ${studyRecommendedMaterials}
      WHERE ${studyRecommendedMaterials.ownerKey} = ${ownerKey}
        AND ${studyRecommendedMaterials.materialId} = ${studyMaterials.id}
    )`;
    const rows = await this.db
      .select({
        id: studyMaterials.id,
        contentKey: studyMaterials.contentKey,
        canonicalUrl: studyMaterials.canonicalUrl,
        title: studyMaterials.title,
        publishedAt: studyMaterials.publishedAt,
        excerpt: studyMaterials.excerpt,
        kind: studyMaterials.kind,
        starred: studyMaterialStates.starred,
        read: studyMaterialStates.read,
        note: studyMaterialStates.note,
        stateVersion: studyMaterialStates.version,
        stateUpdatedAt: studyMaterialStates.updatedAt,
        previouslyRecommended: recommendationExists,
      })
      .from(studyMaterials)
      .leftJoin(
        studyMaterialStates,
        and(
          eq(studyMaterialStates.ownerKey, ownerKey),
          eq(studyMaterialStates.materialId, studyMaterials.id),
        ),
      )
      .where(eq(studyMaterials.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const related = await this.getMaterialRelations([row.id]);
    return {
      id: row.id,
      contentKey: row.contentKey,
      canonicalUrl: row.canonicalUrl,
      title: row.title,
      publishedAt: row.publishedAt,
      excerpt: row.excerpt,
      kind: row.kind,
      tags: related.tags.get(row.id) ?? [],
      sources: related.sources.get(row.id) ?? [],
      state: {
        starred: row.starred ?? false,
        read: row.read ?? false,
        note: row.note ?? "",
        version: row.stateVersion ?? 0,
        updatedAt: row.stateUpdatedAt ?? null,
      },
      previouslyRecommended: Boolean(row.previouslyRecommended),
    };
  }

  async updateMaterialState(
    materialId: number,
    input: UpdateMaterialStateRequest,
    ownerKey: string,
    now = new Date(),
  ): Promise<UpdateStudyMaterialStateResult> {
    return this.db.transaction(async (tx) => {
      const materials = await tx
        .select({ id: studyMaterials.id })
        .from(studyMaterials)
        .where(eq(studyMaterials.id, materialId))
        .limit(1);
      if (!materials[0]) return { status: "not_found" };

      const nextVersion = input.expectedVersion + 1;
      if (nextVersion > 0xffffffff) return { status: "version_conflict" };
      if (input.expectedVersion === 0) {
        const state: StudyMaterialState = {
          ownerKey,
          materialId,
          starred: input.starred ?? false,
          read: input.read ?? false,
          note: input.note ?? "",
          version: nextVersion,
          updatedAt: now,
        };
        try {
          await tx.insert(studyMaterialStates).values(state);
          return { status: "success", state };
        } catch (error) {
          if (isDuplicateKeyError(error)) return { status: "version_conflict" };
          throw error;
        }
      }

      const values: Partial<Pick<StudyMaterialState, "starred" | "read" | "note">> & {
        version: number;
        updatedAt: Date;
      } = { version: nextVersion, updatedAt: now };
      if (input.starred !== undefined) values.starred = input.starred;
      if (input.read !== undefined) values.read = input.read;
      if (input.note !== undefined) values.note = input.note;
      const updateResult = await tx
        .update(studyMaterialStates)
        .set(values)
        .where(
          and(
            eq(studyMaterialStates.ownerKey, ownerKey),
            eq(studyMaterialStates.materialId, materialId),
            eq(studyMaterialStates.version, input.expectedVersion),
          ),
        );
      if (affectedRows(updateResult) !== 1) return { status: "version_conflict" };

      const rows = await tx
        .select()
        .from(studyMaterialStates)
        .where(
          and(
            eq(studyMaterialStates.ownerKey, ownerKey),
            eq(studyMaterialStates.materialId, materialId),
          ),
        )
        .limit(1);
      const state = rows[0];
      if (!state) throw new Error("개인 상태를 갱신한 뒤 조회하지 못했습니다.");
      return { status: "success", state };
    });
  }

  private materialConditions(input: StudyMaterialPageRequest, ownerKey: string): SQL[] {
    const conditions: SQL[] = [lte(studyMaterials.id, input.maximumId)];
    if (input.lastId !== undefined) conditions.push(lt(studyMaterials.id, input.lastId));
    if (input.kind !== undefined) conditions.push(eq(studyMaterials.kind, input.kind));
    if (input.publishedFrom !== undefined) conditions.push(gte(studyMaterials.publishedAt, input.publishedFrom));
    if (input.publishedTo !== undefined) conditions.push(lt(studyMaterials.publishedAt, input.publishedTo));
    if (input.publishedFrom !== undefined || input.publishedTo !== undefined) {
      conditions.push(sql`${studyMaterials.publishedAt} IS NOT NULL`);
    }
    if (input.q !== undefined && input.q.length > 0) {
      const pattern = `%${escapeLike(input.q)}%`;
      conditions.push(
        sql`(${studyMaterials.title} LIKE ${pattern} ESCAPE '\\\\' OR ${studyMaterials.excerpt} LIKE ${pattern} ESCAPE '\\\\')`,
      );
    }
    if (input.starred !== undefined) {
      conditions.push(sql`COALESCE(${studyMaterialStates.starred}, FALSE) = ${input.starred}`);
    }
    if (input.read !== undefined) {
      conditions.push(sql`COALESCE(${studyMaterialStates.read}, FALSE) = ${input.read}`);
    }
    if (input.sourceKey !== undefined || input.category !== undefined) {
      const sourceConditions: SQL[] = [eq(studyMaterialSources.materialId, studyMaterials.id)];
      if (input.sourceKey !== undefined) sourceConditions.push(eq(studyMaterialSources.sourceKey, input.sourceKey));
      if (input.category !== undefined) sourceConditions.push(eq(studySources.category, input.category));
      conditions.push(
        exists(
          this.db
            .select({ value: sql`1` })
            .from(studyMaterialSources)
            .innerJoin(studySources, eq(studySources.sourceKey, studyMaterialSources.sourceKey))
            .where(and(...sourceConditions)),
        ),
      );
    }
    if (input.recommended !== undefined) {
      const query = this.db
        .select({ value: sql`1` })
        .from(studyRecommendedMaterials)
        .where(
          and(
            eq(studyRecommendedMaterials.ownerKey, ownerKey),
            eq(studyRecommendedMaterials.materialId, studyMaterials.id),
          ),
        );
      conditions.push(input.recommended ? exists(query) : notExists(query));
    }
    return conditions;
  }

  private candidateSourceConditions(input: StudyCandidateFilters): SQL[] {
    const conditions: SQL[] = [eq(studySources.enabled, true)];
    if (input.sourceKey !== undefined) conditions.push(eq(studySources.sourceKey, input.sourceKey));
    if (input.category !== undefined) conditions.push(eq(studySources.category, input.category));
    return conditions;
  }

  private async getMaterialRelations(materialIds: number[]): Promise<{
    tags: Map<number, string[]>;
    sources: Map<number, StudyMaterialRecord["sources"]>;
  }> {
    const tags = new Map<number, string[]>();
    const sources = new Map<number, StudyMaterialRecord["sources"]>();
    if (materialIds.length === 0) return { tags, sources };

    const [tagRows, sourceRows] = await Promise.all([
      this.db
        .select({ materialId: studyMaterialTags.materialId, tag: studyMaterialTags.tag })
        .from(studyMaterialTags)
        .where(inArray(studyMaterialTags.materialId, materialIds))
        .orderBy(asc(studyMaterialTags.materialId), asc(studyMaterialTags.tag)),
      this.db
        .select({
          materialId: studyMaterialSources.materialId,
          sourceKey: studySources.sourceKey,
          sourceName: studySources.title,
          category: studySources.category,
        })
        .from(studyMaterialSources)
        .innerJoin(studySources, eq(studySources.sourceKey, studyMaterialSources.sourceKey))
        .where(inArray(studyMaterialSources.materialId, materialIds))
        .orderBy(asc(studyMaterialSources.materialId), asc(studySources.sourceKey)),
    ]);
    for (const row of tagRows) {
      const values = tags.get(row.materialId) ?? [];
      values.push(row.tag);
      tags.set(row.materialId, values);
    }
    for (const row of sourceRows) {
      const values = sources.get(row.materialId) ?? [];
      values.push({
        sourceKey: row.sourceKey,
        sourceName: row.sourceName,
        category: row.category,
      });
      sources.set(row.materialId, values);
    }
    return { tags, sources };
  }
}
