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
  studyRecommendationControl,
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
  IngestBatchInput,
  IngestBatchResult,
  MaterialKind,
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
    const page = await this.listMaterials({ limit: 1, maximumId: id, lastId: id + 1 }, ownerKey);
    return page.records.find((record) => record.id === id) ?? null;
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
