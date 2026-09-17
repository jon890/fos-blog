import { z } from "zod";

const unicodeLength = (value: string) => [...value].length;
const textSchema = (minimum: number, maximum: number) =>
  z.string().refine(
    (value) => unicodeLength(value) >= minimum && unicodeLength(value) <= maximum,
    { message: `${minimum}~${maximum}자의 문자열이어야 합니다.` },
  );
const nonBlankTextSchema = (maximum: number) =>
  textSchema(1, maximum).refine((value) => value.trim().length > 0, {
    message: "공백만 있는 문자열은 허용되지 않습니다.",
  });
const uniqueArray = <T>(values: T[]) => new Set(values).size === values.length;

export const studyIdentifierSchema = textSchema(1, 128).regex(
  /^[A-Za-z0-9._:-]+$/,
  "영문자, 숫자와 ._:- 문자만 사용할 수 있습니다.",
);
export const contentKeySchema = textSchema(1, 191);
export const positiveSafeIntegerSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const unsignedVersionSchema = z.number().int().nonnegative().max(0xffffffff);
export const utcDateTimeSchema = z.iso.datetime();
export const httpsUrlSchema = textSchema(1, 2048)
  .pipe(z.url())
  .refine((value) => new URL(value).protocol === "https:", {
    message: "HTTPS URL만 허용됩니다.",
  });

export const sourceCategorySchema = z.enum(["techBlog", "geek", "ai", "video"]);
export const sourceAdapterSchema = z.enum(["feed", "page", "youtube"]);
export const materialKindSchema = z.enum([
  "feed-article",
  "feed-video",
  "page-link",
  "page-video",
]);
export const careerValueSchema = z.enum([
  "current-work",
  "target-role",
  "engineering-judgment",
  "product-business",
]);
export const studyErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VERSION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "ALREADY_RECOMMENDED",
  "RECENT_TOPIC_CONFLICT",
  "IMPORT_CHANGED",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "UNAVAILABLE",
]);

const sourceShape = {
  sourceKey: studyIdentifierSchema,
  title: nonBlankTextSchema(500),
  category: sourceCategorySchema,
  url: httpsUrlSchema.nullable(),
  feedUrl: httpsUrlSchema.nullable(),
  adapter: sourceAdapterSchema,
  enabled: z.boolean(),
};

function validateSourceUrlCombination(
  source: { url: string | null; feedUrl: string | null; adapter: z.infer<typeof sourceAdapterSchema> },
  ctx: z.RefinementCtx,
) {
  if (source.url === null && source.feedUrl === null) {
    ctx.addIssue({ code: "custom", path: ["url"], message: "url과 feedUrl 중 하나는 필요합니다." });
  }
  if (source.adapter === "feed" && source.feedUrl === null) {
    ctx.addIssue({ code: "custom", path: ["feedUrl"], message: "feed adapter에는 feedUrl이 필요합니다." });
  }
  if (source.adapter !== "feed" && source.url === null) {
    ctx.addIssue({ code: "custom", path: ["url"], message: `${source.adapter} adapter에는 url이 필요합니다.` });
  }
}

export const sourceSchema = z
  .strictObject({
    ...sourceShape,
    version: unsignedVersionSchema,
  })
  .superRefine(validateSourceUrlCombination);
export const listSourcesResponseSchema = z.strictObject({ sources: z.array(sourceSchema) });

const topicKeySchema = textSchema(1, 128).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  "topicKey는 소문자 영문·숫자와 하이픈 구분자를 사용해야 합니다.",
);

export const materialStateSchema = z.strictObject({
  starred: z.boolean(),
  read: z.boolean(),
  note: textSchema(0, 5000),
  version: unsignedVersionSchema,
  updatedAt: utcDateTimeSchema.nullable(),
});
export const materialSourceSchema = z.strictObject({
  sourceKey: studyIdentifierSchema,
  sourceName: nonBlankTextSchema(500),
  category: sourceCategorySchema,
});
export const materialSchema = z.strictObject({
  id: positiveSafeIntegerSchema,
  contentKey: contentKeySchema,
  canonicalUrl: httpsUrlSchema,
  title: nonBlankTextSchema(500),
  publishedAt: utcDateTimeSchema.nullable(),
  excerpt: textSchema(0, 2000).nullable(),
  tags: z.array(nonBlankTextSchema(50)).max(20),
  kind: materialKindSchema,
  sources: z.array(materialSourceSchema),
  state: materialStateSchema,
  previouslyRecommended: z.boolean(),
});
export const listMaterialsResponseSchema = z.strictObject({
  items: z.array(materialSchema),
  nextCursor: z.string().nullable(),
});
export const getMaterialResponseSchema = z.strictObject({ material: materialSchema });
export const updateMaterialStateRequestSchema = z
  .strictObject({
    expectedVersion: unsignedVersionSchema,
    starred: z.boolean().optional(),
    read: z.boolean().optional(),
    note: textSchema(0, 5000).optional(),
  })
  .refine(
    (value) => value.starred !== undefined || value.read !== undefined || value.note !== undefined,
    { message: "starred, read, note 중 하나 이상이 필요합니다." },
  );
export const updateMaterialStateResponseSchema = z.strictObject({ state: materialStateSchema });

export const recommendationRunSummarySchema = z.strictObject({
  reportId: studyIdentifierSchema,
  generatedAt: utcDateTimeSchema,
  topicCount: z.number().int().nonnegative(),
});
export const listRecommendationRunsResponseSchema = z.strictObject({
  items: z.array(recommendationRunSummarySchema),
  nextCursor: z.string().nullable(),
});
export const recommendationRunItemSchema = z.strictObject({
  materialId: positiveSafeIntegerSchema,
  contentKey: contentKeySchema,
  title: nonBlankTextSchema(500),
  canonicalUrl: httpsUrlSchema,
  summary: nonBlankTextSchema(300).nullable(),
  reason: nonBlankTextSchema(300).nullable(),
  careerValue: careerValueSchema.nullable(),
  state: materialStateSchema,
});
export const recommendationRunTopicSchema = z.strictObject({
  topicKey: topicKeySchema,
  title: nonBlankTextSchema(300),
  careerQuestion: nonBlankTextSchema(300).nullable(),
  items: z.array(recommendationRunItemSchema),
});
export const publicationRecordSchema = z.strictObject({
  publicationId: positiveSafeIntegerSchema,
  channel: textSchema(1, 128),
  publishedAt: utcDateTimeSchema,
  externalId: textSchema(1, 128),
  url: httpsUrlSchema.nullable(),
});
export const getRecommendationRunResponseSchema = z.strictObject({
  reportId: studyIdentifierSchema,
  generatedAt: utcDateTimeSchema,
  topics: z.array(recommendationRunTopicSchema),
  publications: z.array(publicationRecordSchema),
});

// URL 정규화와 자료 키 계산은 Backend 가 소유한다. 화면은 형식만 확인한다.
export const importItemSchema = z.strictObject({
  contentKey: contentKeySchema,
  canonicalUrl: httpsUrlSchema,
  sourceKey: studyIdentifierSchema,
  title: nonBlankTextSchema(500),
  category: sourceCategorySchema,
  summary: nonBlankTextSchema(300).nullable(),
  reason: nonBlankTextSchema(300).nullable(),
  careerValue: careerValueSchema.nullable(),
});
export const importTopicSchema = z.strictObject({
  topicKey: topicKeySchema,
  title: nonBlankTextSchema(300),
  careerQuestion: nonBlankTextSchema(300).nullable(),
  items: z.array(importItemSchema).min(1).max(100),
});
export const importReportSchema = z
  .strictObject({
    reportId: studyIdentifierSchema,
    generatedAt: utcDateTimeSchema,
    topics: z.array(importTopicSchema).max(20),
  })
  .superRefine((report, ctx) => {
    const topicKeys = report.topics.map((topic) => topic.topicKey);
    const contentKeys = report.topics.flatMap((topic) => topic.items.map((item) => item.contentKey));
    if (!uniqueArray(topicKeys)) {
      ctx.addIssue({ code: "custom", path: ["topics"], message: "topicKey는 리포트 안에서 중복될 수 없습니다." });
    }
    if (!uniqueArray(contentKeys)) {
      ctx.addIssue({ code: "custom", path: ["topics"], message: "contentKey는 리포트 안에서 중복될 수 없습니다." });
    }
    if (contentKeys.length > 100) {
      ctx.addIssue({ code: "custom", path: ["topics"], message: "리포트 자료는 최대 100개입니다." });
    }
  });
const importPayloadShape = {
  importKey: studyIdentifierSchema,
  reports: z.array(importReportSchema).min(1).max(100),
};
export const importDryRunRequestSchema = z
  .strictObject(importPayloadShape)
  .superRefine((payload, ctx) => {
    if (!uniqueArray(payload.reports.map((report) => report.reportId))) {
      ctx.addIssue({ code: "custom", path: ["reports"], message: "reportId는 중복될 수 없습니다." });
    }
  });
export const importCommitRequestSchema = z
  .strictObject({
    ...importPayloadShape,
    previewHash: z.string().regex(/^[a-f0-9]{64}$/),
    expectedHistoryVersion: unsignedVersionSchema,
  })
  .superRefine((payload, ctx) => {
    if (!uniqueArray(payload.reports.map((report) => report.reportId))) {
      ctx.addIssue({ code: "custom", path: ["reports"], message: "reportId는 중복될 수 없습니다." });
    }
  });
export const importCountsSchema = z.strictObject({
  reports: z.number().int().nonnegative(),
  items: z.number().int().nonnegative(),
  newMaterials: z.number().int().nonnegative(),
  repeatedContentKeys: z.number().int().nonnegative(),
  existingReports: z.number().int().nonnegative(),
});
export const importWarningSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string().min(1),
});
export const importDryRunResponseSchema = z.strictObject({
  previewHash: z.string().regex(/^[a-f0-9]{64}$/),
  historyVersion: unsignedVersionSchema,
  counts: importCountsSchema,
  warnings: z.array(importWarningSchema),
});
export const importCommitResponseSchema = z.strictObject({
  importKey: studyIdentifierSchema,
  counts: importCountsSchema,
  historyVersion: unsignedVersionSchema,
});

export const studyErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: studyErrorCodeSchema,
    message: z.string(),
    requestId: z.string().min(1),
  }),
});

/** 관리자 화면이 자료 목록을 조회할 때 Server Action 에 넘기는 조건이다. */
export type StudyMaterialQuery = {
  limit?: number;
  cursor?: string | null;
  q?: string;
  sourceKey?: string;
  category?: z.infer<typeof sourceCategorySchema>;
  kind?: z.infer<typeof materialKindSchema>;
  starred?: boolean;
  read?: boolean;
  recommended?: boolean;
  publishedFrom?: string;
  publishedTo?: string;
};

/** 추천 이력 목록 조회 조건이다. */
export type StudyRecommendationRunQuery = {
  limit?: number;
  cursor?: string | null;
};

/** 필터 목록이 쓰는 소스 요약이다. */
export type StudySourceSummary = {
  sourceKey: string;
  sourceName: string;
};

/** 관리자 화면이 구분하는 Server Action 실패 종류다. */
export type StudyActionErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "import-changed"
  | "failed";

/** Server Action 은 예외 대신 이 결과를 돌려준다. 브라우저로 내부 정보를 흘리지 않는다. */
export type StudyActionResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; code: StudyActionErrorCode; message: string };

export type SourceCategory = z.infer<typeof sourceCategorySchema>;
export type SourceAdapter = z.infer<typeof sourceAdapterSchema>;
export type MaterialKind = z.infer<typeof materialKindSchema>;
export type CareerValue = z.infer<typeof careerValueSchema>;
export type StudyErrorCode = z.infer<typeof studyErrorCodeSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type MaterialState = z.infer<typeof materialStateSchema>;
export type Material = z.infer<typeof materialSchema>;
export type UpdateMaterialStateRequest = z.infer<typeof updateMaterialStateRequestSchema>;
export type RecommendationRunSummary = z.infer<typeof recommendationRunSummarySchema>;
export type ListRecommendationRunsResult = z.infer<typeof listRecommendationRunsResponseSchema>;
export type RecommendationRunItem = z.infer<typeof recommendationRunItemSchema>;
export type RecommendationRunTopic = z.infer<typeof recommendationRunTopicSchema>;
export type PublicationRecord = z.infer<typeof publicationRecordSchema>;
export type GetRecommendationRunResult = z.infer<typeof getRecommendationRunResponseSchema>;
export type ImportItem = z.infer<typeof importItemSchema>;
export type ImportTopic = z.infer<typeof importTopicSchema>;
export type ImportReport = z.infer<typeof importReportSchema>;
export type ImportDryRunRequest = z.infer<typeof importDryRunRequestSchema>;
export type ImportCommitRequest = z.infer<typeof importCommitRequestSchema>;
export type ImportCounts = z.infer<typeof importCountsSchema>;
export type ImportWarning = z.infer<typeof importWarningSchema>;
export type ImportDryRunResult = z.infer<typeof importDryRunResponseSchema>;
export type ImportCommitResult = z.infer<typeof importCommitResponseSchema>;
