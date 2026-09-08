import { describe, expect, it } from "vitest";
import {
  importDryRunRequestSchema,
  ingestionMaterialSchema,
  ingestionRequestSchema,
  listMaterialsQuerySchema,
  putSourceRequestSchema,
  sourceCursorResponseSchema,
  updateMaterialStateRequestSchema,
} from "./contracts";
import { canonicalizeStudyUrl, studyContentKey } from "./url-identity";

const sourceInput = {
  title: "기술 블로그",
  category: "techBlog" as const,
  url: "https://example.com",
  feedUrl: null,
  adapter: "page" as const,
  enabled: true,
  expectedVersion: 0,
};
const materialInput = (url = "https://example.com/posts/1?utm_source=test") => ({
  contentKey: studyContentKey(url),
  canonicalUrl: canonicalizeStudyUrl(url),
  url,
  title: "자료 제목",
  published: "2026-09-08",
  publishedAt: "2026-09-08T01:02:03.456Z",
  excerpt: null,
  kind: "page-link" as const,
  tags: ["backend"],
  collectedAt: "2026-09-08T02:03:04Z",
});

describe("학습자료 공통 입력 계약", () => {
  it("소스의 선택 URL은 생략을 거절하고 명시적인 null과 adapter 조합을 구분한다", () => {
    expect(putSourceRequestSchema.safeParse(sourceInput).success).toBe(true);
    const omitted: Partial<typeof sourceInput> = { ...sourceInput };
    delete omitted.feedUrl;
    expect(putSourceRequestSchema.safeParse(omitted).success).toBe(false);
    expect(
      putSourceRequestSchema.safeParse({
        ...sourceInput,
        adapter: "feed",
        feedUrl: null,
      }).success,
    ).toBe(false);
    expect(
      putSourceRequestSchema.safeParse({
        ...sourceInput,
        adapter: "feed",
        url: null,
        feedUrl: "https://example.com/feed.xml",
      }).success,
    ).toBe(true);
  });

  it("쓰기 입력의 unknown field와 HTTP URL을 거절한다", () => {
    expect(
      putSourceRequestSchema.safeParse({ ...sourceInput, ownerKey: "attacker" }).success,
    ).toBe(false);
    expect(
      putSourceRequestSchema.safeParse({ ...sourceInput, url: "http://example.com" }).success,
    ).toBe(false);
  });

  it("Unicode 문자 수로 경계를 계산한다", () => {
    const emoji = "😀";
    expect(putSourceRequestSchema.safeParse({ ...sourceInput, title: emoji.repeat(500) }).success).toBe(true);
    expect(putSourceRequestSchema.safeParse({ ...sourceInput, title: emoji.repeat(501) }).success).toBe(false);
    expect(
      updateMaterialStateRequestSchema.safeParse({
        expectedVersion: 0,
        note: emoji.repeat(5000),
      }).success,
    ).toBe(true);
    expect(
      updateMaterialStateRequestSchema.safeParse({
        expectedVersion: 0,
        note: emoji.repeat(5001),
      }).success,
    ).toBe(false);
  });

  it("자료의 전송 contentKey와 canonicalUrl이 원본 URL과 다르면 거절한다", () => {
    const material = materialInput();
    expect(ingestionMaterialSchema.safeParse(material).success).toBe(true);
    expect(
      ingestionMaterialSchema.safeParse({ ...material, contentKey: "url:wrong" }).success,
    ).toBe(false);
    expect(
      ingestionMaterialSchema.safeParse({ ...material, canonicalUrl: material.url }).success,
    ).toBe(false);
  });

  it("배치 contentKey와 tags 중복을 거절하고 빈 배치는 허용한다", () => {
    const material = materialInput();
    const batch = {
      sourceKey: "source-1",
      mode: "recent" as const,
      items: [material],
      cursor: null,
      expectedCursorVersion: 0,
      idempotencyKey: "batch-1",
    };
    expect(ingestionRequestSchema.safeParse(batch).success).toBe(true);
    expect(ingestionRequestSchema.safeParse({ ...batch, items: [] }).success).toBe(true);
    expect(ingestionRequestSchema.safeParse({ ...batch, items: [material, material] }).success).toBe(false);
    expect(
      ingestionRequestSchema.safeParse({
        ...batch,
        items: [{ ...material, tags: ["backend", "backend"] }],
      }).success,
    ).toBe(false);
  });

  it("cursor는 JSON 객체 또는 null이고 UTF-8 64 KiB 제한을 적용한다", () => {
    expect(
      sourceCursorResponseSchema.safeParse({
        sourceKey: "source-1",
        mode: "archive",
        cursor: { pageToken: "next" },
        version: 1,
      }).success,
    ).toBe(true);
    expect(
      sourceCursorResponseSchema.safeParse({
        sourceKey: "source-1",
        mode: "archive",
        cursor: ["not", "object"],
        version: 1,
      }).success,
    ).toBe(false);
    expect(
      sourceCursorResponseSchema.safeParse({
        sourceKey: "source-1",
        mode: "archive",
        cursor: { token: "가".repeat(22_000) },
        version: 1,
      }).success,
    ).toBe(false);
  });

  it("개인 상태는 null과 빈 patch를 거절하고 빈 note는 허용한다", () => {
    expect(updateMaterialStateRequestSchema.safeParse({ expectedVersion: 1 }).success).toBe(false);
    expect(
      updateMaterialStateRequestSchema.safeParse({ expectedVersion: 1, note: null }).success,
    ).toBe(false);
    expect(
      updateMaterialStateRequestSchema.safeParse({ expectedVersion: 1, note: "" }).success,
    ).toBe(true);
  });

  it("boolean query와 반열린 날짜 범위 입력을 엄격히 검증한다", () => {
    expect(listMaterialsQuerySchema.parse({ starred: "false" }).starred).toBe(false);
    expect(listMaterialsQuerySchema.safeParse({ starred: "0" }).success).toBe(false);
    expect(
      listMaterialsQuerySchema.safeParse({
        publishedFrom: "2026-09-08T00:00:00Z",
        publishedTo: "2026-09-08T00:00:00Z",
      }).success,
    ).toBe(false);
  });

  it("가져오기 배열 중복과 nullable 과거 필드를 구분한다", () => {
    const item = {
      contentKey: studyContentKey("https://example.com/imported"),
      canonicalUrl: canonicalizeStudyUrl("https://example.com/imported"),
      sourceKey: "source-1",
      title: "과거 자료",
      category: "techBlog" as const,
      summary: null,
      reason: null,
      careerValue: null,
    };
    const report = {
      reportId: "report-1",
      generatedAt: "2026-09-08T00:00:00Z",
      topics: [{
        topicKey: "backend-design",
        title: "백엔드 설계",
        careerQuestion: null,
        items: [item],
      }],
    };
    expect(importDryRunRequestSchema.safeParse({ importKey: "import-1", reports: [report] }).success).toBe(true);
    expect(importDryRunRequestSchema.safeParse({ importKey: "import-1", reports: [report, report] }).success).toBe(false);
    expect(
      importDryRunRequestSchema.safeParse({
        importKey: "import-1",
        reports: [{
          ...report,
          topics: [{ ...report.topics[0], items: [item, item] }],
        }],
      }).success,
    ).toBe(false);
  });
});
