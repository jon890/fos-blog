import { z } from "zod";
import { canonicalizeStudyUrl, studyContentKey } from "./url-identity";

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
export const cursorModeSchema = z.enum(["recent", "archive"]);
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
export const recommendationOriginSchema = z.enum(["live", "import"]);
export const requestOperationSchema = z.enum(["ingestion", "publication", "import"]);
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
export const putSourceRequestSchema = z
  .strictObject({
    title: sourceShape.title,
    category: sourceShape.category,
    url: sourceShape.url,
    feedUrl: sourceShape.feedUrl,
    adapter: sourceShape.adapter,
    enabled: sourceShape.enabled,
    expectedVersion: unsignedVersionSchema,
  })
  .superRefine(validateSourceUrlCombination);
export const putSourceResponseSchema = z
  .strictObject({
    source: sourceSchema,
    version: unsignedVersionSchema,
  })
  .refine((response) => response.source.version === response.version, {
    path: ["version"],
    message: "응답 version은 source.version과 같아야 합니다.",
  });
export const listSourcesResponseSchema = z.strictObject({ sources: z.array(sourceSchema) });

const cursorObjectSchema = z.json().superRefine((value, ctx) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    ctx.addIssue({ code: "custom", message: "cursor는 JSON 객체여야 합니다." });
    return;
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 64 * 1024) {
    ctx.addIssue({ code: "custom", message: "cursor는 64 KiB 이하여야 합니다." });
  }
});
export const studyCursorSchema = cursorObjectSchema.nullable();
export const sourceCursorResponseSchema = z.strictObject({
  sourceKey: studyIdentifierSchema,
  mode: cursorModeSchema,
  cursor: studyCursorSchema,
  version: unsignedVersionSchema,
});

const ingestionMaterialShape = {
  contentKey: contentKeySchema,
  canonicalUrl: httpsUrlSchema,
  url: httpsUrlSchema,
  title: nonBlankTextSchema(500),
  published: textSchema(0, 128),
  publishedAt: utcDateTimeSchema.nullable(),
  excerpt: textSchema(0, 2000).nullable(),
  kind: materialKindSchema,
  tags: z.array(nonBlankTextSchema(50)).max(20),
  collectedAt: utcDateTimeSchema,
};

function validateUrlIdentity(
  value: { contentKey: string; canonicalUrl: string; url: string },
  ctx: z.RefinementCtx,
) {
  let canonicalUrl: string;
  let contentKey: string;
  try {
    canonicalUrl = canonicalizeStudyUrl(value.url);
    contentKey = studyContentKey(value.url);
  } catch {
    ctx.addIssue({ code: "custom", path: ["url"], message: "유효한 HTTPS 자료 URL이어야 합니다." });
    return;
  }
  if (value.canonicalUrl !== canonicalUrl) {
    ctx.addIssue({ code: "custom", path: ["canonicalUrl"], message: "정규 URL이 원본 URL과 일치하지 않습니다." });
  }
  if (value.contentKey !== contentKey) {
    ctx.addIssue({ code: "custom", path: ["contentKey"], message: "자료 키가 원본 URL과 일치하지 않습니다." });
  }
}

export const ingestionMaterialSchema = z
  .strictObject(ingestionMaterialShape)
  .superRefine((item, ctx) => {
    validateUrlIdentity(item, ctx);
    if (!uniqueArray(item.tags)) {
      ctx.addIssue({ code: "custom", path: ["tags"], message: "tags 항목은 중복될 수 없습니다." });
    }
  });
export const ingestionRequestSchema = z
  .strictObject({
    sourceKey: studyIdentifierSchema,
    mode: cursorModeSchema,
    items: z.array(ingestionMaterialSchema).max(100),
    cursor: studyCursorSchema,
    expectedCursorVersion: unsignedVersionSchema,
    idempotencyKey: studyIdentifierSchema,
  })
  .superRefine((batch, ctx) => {
    const keys = batch.items.map((item) => item.contentKey);
    if (!uniqueArray(keys)) {
      ctx.addIssue({ code: "custom", path: ["items"], message: "items의 contentKey는 중복될 수 없습니다." });
    }
  });
export const ingestionResponseSchema = z.strictObject({
  idempotencyKey: studyIdentifierSchema,
  acceptedCount: z.number().int().nonnegative().max(100),
  cursorVersion: unsignedVersionSchema,
});

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
export const candidateSchema = z
  .strictObject({
    id: contentKeySchema,
    contentKey: contentKeySchema,
    canonicalUrl: httpsUrlSchema,
    sourceKey: studyIdentifierSchema,
    sourceName: nonBlankTextSchema(500),
    category: sourceCategorySchema,
    title: nonBlankTextSchema(500),
    url: httpsUrlSchema,
    published: textSchema(0, 128),
    excerpt: textSchema(0, 2000).optional(),
    kind: materialKindSchema,
    previouslyRecommended: z.boolean(),
  })
  .refine((candidate) => candidate.id === candidate.contentKey, {
    path: ["id"],
    message: "Candidate.id는 contentKey와 같아야 합니다.",
  });
export const listMaterialsResponseSchema = z.strictObject({
  items: z.array(materialSchema),
  nextCursor: z.string().nullable(),
});
export const getMaterialResponseSchema = z.strictObject({ material: materialSchema });
export const listCandidatesResponseSchema = z.strictObject({
  candidates: z.array(candidateSchema),
  recentStudyTopicKeys: z.array(textSchema(1, 128)),
  nextCursor: z.string().nullable(),
  historyVersion: unsignedVersionSchema,
});

const listQueryShape = {
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().min(1).optional(),
  sourceKey: studyIdentifierSchema.optional(),
  category: sourceCategorySchema.optional(),
  kind: materialKindSchema.optional(),
  publishedFrom: utcDateTimeSchema.optional(),
  publishedTo: utcDateTimeSchema.optional(),
};
function validateDateRange(
  query: { publishedFrom?: string; publishedTo?: string },
  ctx: z.RefinementCtx,
) {
  if (
    query.publishedFrom !== undefined &&
    query.publishedTo !== undefined &&
    Date.parse(query.publishedFrom) >= Date.parse(query.publishedTo)
  ) {
    ctx.addIssue({ code: "custom", path: ["publishedTo"], message: "publishedTo는 publishedFrom보다 뒤여야 합니다." });
  }
}
const booleanQuerySchema = z.enum(["true", "false"]).transform((value) => value === "true");
export const listMaterialsQuerySchema = z
  .strictObject({
    ...listQueryShape,
    q: textSchema(0, 200).optional(),
    starred: booleanQuerySchema.optional(),
    read: booleanQuerySchema.optional(),
    recommended: booleanQuerySchema.optional(),
  })
  .superRefine(validateDateRange);
export const listCandidatesQuerySchema = z
  .strictObject(listQueryShape)
  .superRefine(validateDateRange);

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

const recommendationItemSchema = z.strictObject({
  contentKey: contentKeySchema,
  summary: nonBlankTextSchema(300),
  reason: nonBlankTextSchema(300),
  careerValue: careerValueSchema,
});
const topicKeySchema = textSchema(1, 128).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  "topicKey는 소문자 영문·숫자와 하이픈 구분자를 사용해야 합니다.",
);
export const recommendationTopicSchema = z.strictObject({
  topicKey: topicKeySchema,
  title: nonBlankTextSchema(300),
  careerQuestion: nonBlankTextSchema(300),
  items: z.array(recommendationItemSchema).min(1).max(100),
});
export const createRecommendationRunRequestSchema = z
  .strictObject({
    reportId: studyIdentifierSchema,
    generatedAt: utcDateTimeSchema,
    topics: z.array(recommendationTopicSchema).max(20),
  })
  .superRefine((run, ctx) => {
    const topicKeys = run.topics.map((topic) => topic.topicKey);
    const contentKeys = run.topics.flatMap((topic) => topic.items.map((item) => item.contentKey));
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
export const createRecommendationRunResponseSchema = z.strictObject({
  reportId: studyIdentifierSchema,
  historyVersion: unsignedVersionSchema,
});

export const publicationRequestSchema = z.strictObject({
  idempotencyKey: studyIdentifierSchema,
  reportId: studyIdentifierSchema,
  channel: textSchema(1, 128),
  publishedAt: utcDateTimeSchema,
  externalId: textSchema(1, 128),
  url: httpsUrlSchema.nullable(),
});
export const publicationResponseSchema = z.strictObject({ publicationId: positiveSafeIntegerSchema });

export const importItemSchema = z
  .strictObject({
    contentKey: contentKeySchema,
    canonicalUrl: httpsUrlSchema,
    sourceKey: studyIdentifierSchema,
    title: nonBlankTextSchema(500),
    category: sourceCategorySchema,
    summary: nonBlankTextSchema(300).nullable(),
    reason: nonBlankTextSchema(300).nullable(),
    careerValue: careerValueSchema.nullable(),
  })
  .superRefine((item, ctx) => {
    validateUrlIdentity({ ...item, url: item.canonicalUrl }, ctx);
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

export type SourceCategory = z.infer<typeof sourceCategorySchema>;
export type SourceAdapter = z.infer<typeof sourceAdapterSchema>;
export type CursorMode = z.infer<typeof cursorModeSchema>;
export type MaterialKind = z.infer<typeof materialKindSchema>;
export type CareerValue = z.infer<typeof careerValueSchema>;
export type StudyErrorCode = z.infer<typeof studyErrorCodeSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type PutSourceRequest = z.infer<typeof putSourceRequestSchema>;
export type IngestionMaterial = z.infer<typeof ingestionMaterialSchema>;
export type IngestionRequest = z.infer<typeof ingestionRequestSchema>;
export type IngestBatchInput = IngestionRequest;
export type IngestBatchResult = z.infer<typeof ingestionResponseSchema>;
export type MaterialState = z.infer<typeof materialStateSchema>;
export type Material = z.infer<typeof materialSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type UpdateMaterialStateRequest = z.infer<typeof updateMaterialStateRequestSchema>;
export type CreateRecommendationRunRequest = z.infer<typeof createRecommendationRunRequestSchema>;
export type ImportDryRunRequest = z.infer<typeof importDryRunRequestSchema>;
export type ImportCommitRequest = z.infer<typeof importCommitRequestSchema>;
