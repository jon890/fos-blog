import { describe, expect, it } from "vitest";
import {
  importDryRunRequestSchema,
  listSourcesResponseSchema,
  studyErrorResponseSchema,
  updateMaterialStateRequestSchema,
} from "./contracts";

const sourceResponse = {
  sources: [{
    sourceKey: "source-1",
    title: "기술 블로그",
    category: "techBlog" as const,
    url: "https://example.com",
    feedUrl: null,
    adapter: "page" as const,
    enabled: true,
    version: 0,
  }],
};
const importItem = {
  contentKey: "url:e6b7ccaedbf110b1f23a0b27cd070f456bd08ebec74b536a9fb550da3fafdef6",
  canonicalUrl: "https://example.com/imported",
  sourceKey: "source-1",
  title: "과거 자료",
  category: "techBlog" as const,
  summary: null,
  reason: null,
  careerValue: null,
};
const importReport = {
  reportId: "report-1",
  generatedAt: "2026-09-08T00:00:00Z",
  topics: [{
    topicKey: "backend-design",
    title: "백엔드 설계",
    careerQuestion: null,
    items: [importItem],
  }],
};

describe("관리자 화면이 쓰는 학습자료 계약", () => {
  it("소스 응답의 unknown field와 HTTP URL을 거절한다", () => {
    expect(listSourcesResponseSchema.safeParse(sourceResponse).success).toBe(true);
    expect(
      listSourcesResponseSchema.safeParse({
        sources: [{ ...sourceResponse.sources[0], ownerKey: "attacker" }],
      }).success,
    ).toBe(false);
    expect(
      listSourcesResponseSchema.safeParse({
        sources: [{ ...sourceResponse.sources[0], url: "http://example.com" }],
      }).success,
    ).toBe(false);
  });

  it("Unicode 문자 수로 메모 경계를 계산한다", () => {
    const emoji = "😀";
    expect(
      updateMaterialStateRequestSchema.safeParse({ expectedVersion: 0, note: emoji.repeat(5000) }).success,
    ).toBe(true);
    expect(
      updateMaterialStateRequestSchema.safeParse({ expectedVersion: 0, note: emoji.repeat(5001) }).success,
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

  it("가져오기 배열 중복과 nullable 과거 필드를 구분한다", () => {
    expect(importDryRunRequestSchema.safeParse({ importKey: "import-1", reports: [importReport] }).success).toBe(true);
    expect(importDryRunRequestSchema.safeParse({ importKey: "import-1", reports: [importReport, importReport] }).success).toBe(false);
    expect(
      importDryRunRequestSchema.safeParse({
        importKey: "import-1",
        reports: [{
          ...importReport,
          topics: [{ ...importReport.topics[0], items: [importItem, importItem] }],
        }],
      }).success,
    ).toBe(false);
  });

  it("URL 정규화와 자료 키 계산은 Backend 가 소유하므로 화면은 형식만 확인한다", () => {
    const parsed = importDryRunRequestSchema.safeParse({
      importKey: "import-1",
      reports: [{
        ...importReport,
        topics: [{ ...importReport.topics[0], items: [{ ...importItem, contentKey: "url:backend-recalculates" }] }],
      }],
    });
    expect(parsed.success).toBe(true);
  });

  it("오류 envelope 는 계약에 있는 code 만 받는다", () => {
    expect(
      studyErrorResponseSchema.safeParse({
        error: { code: "VERSION_CONFLICT", message: "충돌", requestId: "request-1" },
      }).success,
    ).toBe(true);
    expect(
      studyErrorResponseSchema.safeParse({
        error: { code: "TEAPOT", message: "알 수 없음", requestId: "request-1" },
      }).success,
    ).toBe(false);
  });
});
