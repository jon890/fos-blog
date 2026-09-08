import { and, eq, inArray, sql } from "drizzle-orm";
import type {
  ImportCommitRequest,
  ImportCommitResult,
  ImportCounts,
  ImportDryRunRequest,
  ImportDryRunResult,
  ImportItem,
  ImportReport,
  ImportWarning,
} from "@/lib/study/contracts";
import { studyRequestHash } from "@/lib/study/request-hash";
import { isYouTubeStudyUrl } from "@/lib/study/url-identity";
import {
  studyMaterialSources,
  studyMaterials,
  studyRecommendationControl,
  studyRecommendationItems,
  studyRecommendationRuns,
  studyRecommendationTopics,
  studyRecommendedMaterials,
  studyRequestReceipts,
  studySources,
} from "../schema";
import type { DbInstance } from "./BaseRepository";

type ImportPayload = ImportDryRunRequest;

type ImportRows = {
  historyVersion: number;
  sources: Array<{ sourceKey: string; category: string }>;
  materials: Array<{ id: number; contentKey: string }>;
  reports: Array<{
    id: number;
    reportId: string;
    generatedAt: Date;
    requestHash: string;
    historyVersion: number;
  }>;
};

type ImportAnalysis = {
  counts: ImportCounts;
  warnings: ImportWarning[];
  materialsByKey: Map<string, number>;
  reportsById: Map<string, ImportRows["reports"][number]>;
};

type ImportValidationFailure =
  | { status: "invalid_request"; message: string }
  | { status: "report_conflict"; reportId: string };

export type PreviewStudyImportResult =
  | { status: "success"; response: ImportDryRunResult }
  | ImportValidationFailure;

export type CommitStudyImportResult =
  | { status: "success"; response: ImportCommitResult }
  | { status: "invalid_request"; message: string }
  | { status: "report_conflict"; reportId: string }
  | { status: "import_changed" }
  | { status: "idempotency_conflict" }
  | { status: "version_conflict" };

function isDuplicateKeyError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current !== null; depth += 1) {
    if (typeof current !== "object") return false;
    const candidate = current as { code?: unknown; cause?: unknown };
    if (candidate.code === "ER_DUP_ENTRY") return true;
    current = candidate.cause;
  }
  return false;
}

function importPayload(input: ImportCommitRequest): ImportPayload {
  return { importKey: input.importKey, reports: input.reports };
}

function reportHash(report: ImportReport): string {
  return studyRequestHash(report);
}

function compareReports(
  left: Pick<ImportReport, "generatedAt" | "reportId">,
  right: Pick<ImportReport, "generatedAt" | "reportId">,
): number {
  const timeDifference = Date.parse(left.generatedAt) - Date.parse(right.generatedAt);
  if (timeDifference !== 0) return timeDifference;
  return left.reportId < right.reportId ? -1 : left.reportId > right.reportId ? 1 : 0;
}

function analyzeImport(payload: ImportPayload, rows: ImportRows): ImportAnalysis | ImportValidationFailure {
  const sources = new Map(rows.sources.map((source) => [source.sourceKey, source.category]));
  for (const report of payload.reports) {
    for (const topic of report.topics) {
      for (const item of topic.items) {
        const category = sources.get(item.sourceKey);
        if (category === undefined) {
          return {
            status: "invalid_request",
            message: `등록되지 않은 sourceKey입니다: ${item.sourceKey}`,
          };
        }
        if (category !== item.category) {
          return {
            status: "invalid_request",
            message: `sourceKey의 category가 일치하지 않습니다: ${item.sourceKey}`,
          };
        }
      }
    }
  }

  const reportsById = new Map(rows.reports.map((report) => [report.reportId, report]));
  for (const report of payload.reports) {
    const existing = reportsById.get(report.reportId);
    if (existing && existing.requestHash !== reportHash(report)) {
      return { status: "report_conflict", reportId: report.reportId };
    }
  }

  const materialsByKey = new Map(rows.materials.map((material) => [material.contentKey, material.id]));
  const allContentKeys = payload.reports.flatMap((report) =>
    report.topics.flatMap((topic) => topic.items.map((item) => item.contentKey)),
  );
  const contentKeyCounts = new Map<string, number>();
  for (const contentKey of allContentKeys) {
    contentKeyCounts.set(contentKey, (contentKeyCounts.get(contentKey) ?? 0) + 1);
  }
  const repeated = [...contentKeyCounts]
    .filter(([, count]) => count > 1)
    .sort(([left], [right]) => left.localeCompare(right));
  const warnings: ImportWarning[] = repeated.map(([contentKey, count]) => ({
    code: "REPEATED_CONTENT_KEY",
    message: `${contentKey} 자료가 ${count}개 과거 리포트에 반복됩니다.`,
  }));
  const uniqueContentKeys = [...contentKeyCounts.keys()];
  return {
    counts: {
      reports: payload.reports.length,
      items: allContentKeys.length,
      newMaterials: uniqueContentKeys.filter((contentKey) => !materialsByKey.has(contentKey)).length,
      repeatedContentKeys: allContentKeys.length - uniqueContentKeys.length,
      existingReports: payload.reports.filter((report) => reportsById.has(report.reportId)).length,
    },
    warnings,
    materialsByKey,
    reportsById,
  };
}

function isAnalysis(value: ImportAnalysis | ImportValidationFailure): value is ImportAnalysis {
  return !("status" in value);
}

async function loadImportRows(
  db: DbInstance,
  payload: ImportPayload,
  ownerKey: string,
): Promise<ImportRows> {
  const sourceKeys = [...new Set(payload.reports.flatMap((report) =>
    report.topics.flatMap((topic) => topic.items.map((item) => item.sourceKey)),
  ))];
  const contentKeys = [...new Set(payload.reports.flatMap((report) =>
    report.topics.flatMap((topic) => topic.items.map((item) => item.contentKey)),
  ))];
  const reportIds = payload.reports.map((report) => report.reportId);
  const [controls, sources, materials, reports] = await Promise.all([
    db
      .select({ historyVersion: studyRecommendationControl.historyVersion })
      .from(studyRecommendationControl)
      .where(eq(studyRecommendationControl.ownerKey, ownerKey))
      .limit(1),
    sourceKeys.length === 0
      ? Promise.resolve([])
      : db
        .select({ sourceKey: studySources.sourceKey, category: studySources.category })
        .from(studySources)
        .where(inArray(studySources.sourceKey, sourceKeys)),
    contentKeys.length === 0
      ? Promise.resolve([])
      : db
        .select({ id: studyMaterials.id, contentKey: studyMaterials.contentKey })
        .from(studyMaterials)
        .where(inArray(studyMaterials.contentKey, contentKeys)),
    db
      .select({
        id: studyRecommendationRuns.id,
        reportId: studyRecommendationRuns.reportId,
        generatedAt: studyRecommendationRuns.generatedAt,
        requestHash: studyRecommendationRuns.requestHash,
        historyVersion: studyRecommendationRuns.historyVersion,
      })
      .from(studyRecommendationRuns)
      .where(inArray(studyRecommendationRuns.reportId, reportIds)),
  ]);
  return {
    historyVersion: controls[0]?.historyVersion ?? 0,
    sources,
    materials,
    reports,
  };
}

export async function previewStudyImport(
  db: DbInstance,
  input: ImportDryRunRequest,
  ownerKey: string,
): Promise<PreviewStudyImportResult> {
  const rows = await loadImportRows(db, input, ownerKey);
  const analysis = analyzeImport(input, rows);
  if (!isAnalysis(analysis)) return analysis;
  return {
    status: "success",
    response: {
      previewHash: studyRequestHash(input),
      historyVersion: rows.historyVersion,
      counts: analysis.counts,
      warnings: analysis.warnings,
    },
  };
}

export async function commitStudyImport(
  db: DbInstance,
  input: ImportCommitRequest,
  ownerKey: string,
  now = new Date(),
): Promise<CommitStudyImportResult> {
  const payload = importPayload(input);
  const requestHash = studyRequestHash(payload);
  await db
    .insert(studyRecommendationControl)
    .values({ ownerKey, historyVersion: 0, latestRunId: null })
    .onDuplicateKeyUpdate({
      set: { ownerKey: sql`${studyRecommendationControl.ownerKey}` },
    });

  try {
    return await db.transaction(async (tx) => {
      const controls = await tx
        .select()
        .from(studyRecommendationControl)
        .where(eq(studyRecommendationControl.ownerKey, ownerKey))
        .limit(1)
        .for("update");
      const control = controls[0];
      if (!control) throw new Error("추천 control 행을 잠그지 못했습니다.");

      const receipts = await tx
        .select({ requestHash: studyRequestReceipts.requestHash, response: studyRequestReceipts.response })
        .from(studyRequestReceipts)
        .where(
          and(
            eq(studyRequestReceipts.operation, "import"),
            eq(studyRequestReceipts.requestKey, input.importKey),
          ),
        )
        .limit(1);
      const receipt = receipts[0];
      if (receipt) {
        return receipt.requestHash === requestHash
          ? { status: "success", response: receipt.response as ImportCommitResult }
          : { status: "idempotency_conflict" };
      }

      const sourceKeys = [...new Set(payload.reports.flatMap((report) =>
        report.topics.flatMap((topic) => topic.items.map((item) => item.sourceKey)),
      ))];
      const contentKeys = [...new Set(payload.reports.flatMap((report) =>
        report.topics.flatMap((topic) => topic.items.map((item) => item.contentKey)),
      ))];
      const reportIds = payload.reports.map((report) => report.reportId);
      const [sources, materials, reports] = await Promise.all([
        sourceKeys.length === 0
          ? Promise.resolve([])
          : tx
            .select({ sourceKey: studySources.sourceKey, category: studySources.category })
            .from(studySources)
            .where(inArray(studySources.sourceKey, sourceKeys)),
        contentKeys.length === 0
          ? Promise.resolve([])
          : tx
            .select({ id: studyMaterials.id, contentKey: studyMaterials.contentKey })
            .from(studyMaterials)
            .where(inArray(studyMaterials.contentKey, contentKeys)),
        tx
          .select({
            id: studyRecommendationRuns.id,
            reportId: studyRecommendationRuns.reportId,
            generatedAt: studyRecommendationRuns.generatedAt,
            requestHash: studyRecommendationRuns.requestHash,
            historyVersion: studyRecommendationRuns.historyVersion,
          })
          .from(studyRecommendationRuns)
          .where(inArray(studyRecommendationRuns.reportId, reportIds)),
      ]);
      const analysis = analyzeImport(payload, {
        historyVersion: control.historyVersion,
        sources,
        materials,
        reports,
      });
      if (!isAnalysis(analysis)) return analysis;
      if (requestHash !== input.previewHash || control.historyVersion !== input.expectedHistoryVersion) {
        return { status: "import_changed" };
      }
      if (control.historyVersion === 0xffffffff) return { status: "version_conflict" };

      const historyVersion = control.historyVersion + 1;
      const sortedReports = [...payload.reports].sort(compareReports);
      const firstItems = new Map<string, ImportItem>();
      for (const report of sortedReports) {
        for (const topic of report.topics) {
          for (const item of topic.items) {
            if (!firstItems.has(item.contentKey)) firstItems.set(item.contentKey, item);
          }
        }
      }
      const materialsByKey = new Map(analysis.materialsByKey);
      for (const [contentKey, item] of [...firstItems].sort(([left], [right]) => left.localeCompare(right))) {
        if (materialsByKey.has(contentKey)) continue;
        try {
          await tx.insert(studyMaterials).values({
            contentKey,
            canonicalUrl: item.canonicalUrl,
            url: item.canonicalUrl,
            title: item.title,
            published: "",
            publishedAt: null,
            excerpt: null,
            kind: isYouTubeStudyUrl(item.canonicalUrl) ? "page-video" : "page-link",
            collectedAt: now,
            createdAt: now,
          });
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error;
        }
        const stored = await tx
          .select({ id: studyMaterials.id })
          .from(studyMaterials)
          .where(eq(studyMaterials.contentKey, contentKey))
          .limit(1)
          .for("update");
        if (!stored[0]) throw new Error("가져오기 자료를 저장한 뒤 조회하지 못했습니다.");
        materialsByKey.set(contentKey, stored[0].id);
      }

      const sourcePairs = new Map<string, { materialId: number; sourceKey: string }>();
      for (const report of sortedReports) {
        for (const topic of report.topics) {
          for (const item of topic.items) {
            const materialId = materialsByKey.get(item.contentKey);
            if (!materialId) throw new Error("가져오기 자료 연결을 만들 수 없습니다.");
            sourcePairs.set(`${materialId}\u0000${item.sourceKey}`, { materialId, sourceKey: item.sourceKey });
          }
        }
      }
      for (const pair of sourcePairs.values()) {
        await tx
          .insert(studyMaterialSources)
          .values({ ...pair, collectedAt: now })
          .onDuplicateKeyUpdate({
            set: { sourceKey: sql`${studyMaterialSources.sourceKey}` },
          });
      }

      const runIds = new Map([...analysis.reportsById].map(([reportId, report]) => [reportId, report.id]));
      for (const report of sortedReports) {
        if (runIds.has(report.reportId)) continue;
        const insertedRun = await tx.insert(studyRecommendationRuns).values({
          reportId: report.reportId,
          generatedAt: new Date(report.generatedAt),
          committedAt: now,
          requestHash: reportHash(report),
          historyVersion,
          origin: "import",
        });
        const runId = Number(insertedRun[0].insertId);
        runIds.set(report.reportId, runId);
        for (const [topicPosition, topic] of report.topics.entries()) {
          const insertedTopic = await tx.insert(studyRecommendationTopics).values({
            runId,
            position: topicPosition,
            topicKey: topic.topicKey,
            title: topic.title,
            careerQuestion: topic.careerQuestion,
          });
          const topicId = Number(insertedTopic[0].insertId);
          await tx.insert(studyRecommendationItems).values(
            topic.items.map((item, position) => {
              const materialId = materialsByKey.get(item.contentKey);
              if (!materialId) throw new Error("가져오기 snapshot 자료를 찾을 수 없습니다.");
              return {
                runId,
                topicId,
                position,
                materialId,
                title: item.title,
                canonicalUrl: item.canonicalUrl,
                summary: item.summary,
                reason: item.reason,
                careerValue: item.careerValue,
              };
            }),
          );
        }
      }

      const accumulated = new Set<number>();
      for (const report of sortedReports) {
        const runId = runIds.get(report.reportId);
        if (!runId) throw new Error("가져오기 리포트 ID를 찾을 수 없습니다.");
        for (const topic of report.topics) {
          for (const item of topic.items) {
            const materialId = materialsByKey.get(item.contentKey);
            if (!materialId || accumulated.has(materialId)) continue;
            accumulated.add(materialId);
            await tx
              .insert(studyRecommendedMaterials)
              .values({ ownerKey, materialId, firstRunId: runId })
              .onDuplicateKeyUpdate({
                set: { firstRunId: sql`${studyRecommendedMaterials.firstRunId}` },
              });
          }
        }
      }

      const latestImported = sortedReports.at(-1);
      let latestRunId = control.latestRunId;
      if (latestImported) {
        const latestCurrent = control.latestRunId === null
          ? null
          : (await tx
            .select({ reportId: studyRecommendationRuns.reportId, generatedAt: studyRecommendationRuns.generatedAt })
            .from(studyRecommendationRuns)
            .where(eq(studyRecommendationRuns.id, control.latestRunId))
            .limit(1))[0] ?? null;
        const currentComparable = latestCurrent
          ? { reportId: latestCurrent.reportId, generatedAt: latestCurrent.generatedAt.toISOString() }
          : null;
        if (!currentComparable || compareReports(latestImported, currentComparable) > 0) {
          latestRunId = runIds.get(latestImported.reportId) ?? null;
        }
      }
      await tx
        .update(studyRecommendationControl)
        .set({ historyVersion, latestRunId })
        .where(eq(studyRecommendationControl.ownerKey, ownerKey));

      const response: ImportCommitResult = {
        importKey: input.importKey,
        counts: analysis.counts,
        historyVersion,
      };
      await tx.insert(studyRequestReceipts).values({
        operation: "import",
        requestKey: input.importKey,
        requestHash,
        response,
        createdAt: now,
      });
      return { status: "success", response };
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const receipts = await db
      .select({ requestHash: studyRequestReceipts.requestHash, response: studyRequestReceipts.response })
      .from(studyRequestReceipts)
      .where(
        and(
          eq(studyRequestReceipts.operation, "import"),
          eq(studyRequestReceipts.requestKey, input.importKey),
        ),
      )
      .limit(1);
    if (!receipts[0]) throw error;
    return receipts[0].requestHash === requestHash
      ? { status: "success", response: receipts[0].response as ImportCommitResult }
      : { status: "idempotency_conflict" };
  }
}
