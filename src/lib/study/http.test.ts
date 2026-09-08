import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  parseStudyJson,
  parseStudyQuery,
  methodNotAllowed,
  StudyHttpError,
  studyErrorResponse,
  studyJson,
} from "./http";

describe("학습자료 HTTP 공통 처리", () => {
  it("JSON과 unknown field를 검증한다", async () => {
    const schema = z.strictObject({ value: z.string() });
    await expect(parseStudyJson(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ value: "ok" }),
    }), schema)).resolves.toEqual({ value: "ok" });
    await expect(parseStudyJson(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ value: "ok", unknown: true }),
    }), schema)).rejects.toMatchObject({ status: 400, code: "INVALID_REQUEST" });
  });

  it("Content-Length와 무관하게 실제 본문 1 MiB 초과를 거절한다", async () => {
    const body = JSON.stringify({ value: "a".repeat(1024 * 1024) });
    await expect(parseStudyJson(new Request("https://example.test", {
      method: "POST",
      headers: { "content-length": "1" },
      body,
    }), z.unknown())).rejects.toMatchObject({ status: 413, code: "PAYLOAD_TOO_LARGE" });
  });

  it("query의 중복과 unknown field를 거절한다", () => {
    const schema = z.strictObject({ limit: z.coerce.number().optional() });
    expect(parseStudyQuery("https://example.test?limit=3", schema)).toEqual({ limit: 3 });
    expect(() => parseStudyQuery("https://example.test?limit=3&limit=4", schema)).toThrow(StudyHttpError);
    expect(() => parseStudyQuery("https://example.test?extra=1", schema)).toThrow(StudyHttpError);
  });

  it.each([400, 401, 403, 404, 409, 413, 429, 503])("%i 응답에 개인 헤더를 적용한다", (status) => {
    const response = studyJson({}, { status });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("429의 Retry-After를 보존하고 오류 envelope에 requestId를 넣는다", async () => {
    const response = studyErrorResponse(new StudyHttpError(
      429,
      "RATE_LIMITED",
      "잠시 후 다시 시도해 주세요.",
      { "Retry-After": "7" },
    ), "request-fixture");
    expect(response.headers.get("retry-after")).toBe("7");
    expect(await response.json()).toEqual({
      error: { code: "RATE_LIMITED", message: "잠시 후 다시 시도해 주세요.", requestId: "request-fixture" },
    });
  });

  it("미지원 메서드는 처음부터 405와 Allow 헤더로 응답한다", async () => {
    const response = methodNotAllowed(["GET", "PUT"], "request-method");
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, PUT");
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_REQUEST", requestId: "request-method" },
    });
  });
});
