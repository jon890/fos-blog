import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  careerOsPlan115Import,
  careerOsPlan115UrlIdentity,
} from "./__fixtures__/career-os-plan115";
import {
  commitStudyImport,
  dryRunStudyImport,
  getStudyMaterial,
  getStudyRecommendationRun,
  listStudyMaterials,
  updateStudyMaterialState,
} from "./backend-client";
import type { ImportCommitRequest } from "./contracts";

/**
 * career-os Backend 의 14개 API 는 아직 구현되지 않았다.
 * 이 테스트는 운영 Backend 대신 계약대로 응답하는 mock HTTP server 를 세워
 * fos-blog 소비측이 그 계약과 호환되는지 확인한다.
 */
const ADMIN_TOKEN = "admin-gateway-token-that-is-at-least-32-bytes";
const PRODUCER_TOKEN = "producer-token-that-is-also-at-least-32-bytes";
const PRODUCER_ONLY = ["/ingestions", "/candidates", "/publications"];
const ADMIN_ONLY = ["/materials", "/recommendation-runs", "/imports"];

const PREVIEW_HASH = "b".repeat(64);
const state = { starred: false, read: false, note: "", version: 3, updatedAt: null };
const material = {
  id: 7,
  contentKey: careerOsPlan115UrlIdentity.contentKey,
  canonicalUrl: careerOsPlan115UrlIdentity.canonicalUrl,
  title: "기존 추천 영상",
  publishedAt: null,
  excerpt: null,
  tags: [],
  kind: "page-video",
  sources: [{ sourceKey: "career-os-plan115-youtube", sourceName: "career-os 영상", category: "video" }],
  state,
  previouslyRecommended: true,
};
const counts = { reports: 1, items: 1, newMaterials: 1, repeatedContentKeys: 1, existingReports: 0 };

let server: Server;
let baseUrl: string;

function errorBody(code: string, message: string) {
  return JSON.stringify({ error: { code, message, requestId: "mock-request" } });
}

function roleOf(authorization: string | undefined): "admin-gateway" | "producer" | null {
  if (authorization === `Bearer ${ADMIN_TOKEN}`) return "admin-gateway";
  if (authorization === `Bearer ${PRODUCER_TOKEN}`) return "producer";
  return null;
}

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname.replace("/api/study/v1", "");
    const role = roleOf(request.headers.authorization);
    response.setHeader("content-type", "application/json");

    if (role === null) {
      response.writeHead(401).end(errorBody("UNAUTHENTICATED", "서비스 인증에 실패했습니다."));
      return;
    }
    if (role === "producer" && ADMIN_ONLY.some((prefix) => path.startsWith(prefix))) {
      response.writeHead(403).end(errorBody("FORBIDDEN", "producer 가 사용할 수 없는 요청입니다."));
      return;
    }
    if (role === "admin-gateway" && PRODUCER_ONLY.some((prefix) => path.startsWith(prefix))) {
      response.writeHead(403).end(errorBody("FORBIDDEN", "admin-gateway 가 사용할 수 없는 요청입니다."));
      return;
    }

    if (path === "/materials" && request.method === "GET") {
      const filtered = url.searchParams.get("recommended") === "false" ? [] : [material];
      response.writeHead(200).end(JSON.stringify({ items: filtered, nextCursor: null }));
      return;
    }
    if (path === "/materials/7" && request.method === "GET") {
      response.writeHead(200).end(JSON.stringify({ material }));
      return;
    }
    if (path === "/materials/404" && request.method === "GET") {
      response.writeHead(404).end(errorBody("NOT_FOUND", "자료를 찾을 수 없습니다."));
      return;
    }
    if (path === "/materials/7/state" && request.method === "PATCH") {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { expectedVersion: number };
        if (body.expectedVersion !== state.version) {
          response.writeHead(409).end(errorBody("VERSION_CONFLICT", "이미 저장된 상태가 있습니다."));
          return;
        }
        response.writeHead(200).end(JSON.stringify({ state: { ...state, starred: true, version: state.version + 1 } }));
      });
      return;
    }
    if (path === "/recommendation-runs/career-os-plan115-history" && request.method === "GET") {
      response.writeHead(200).end(JSON.stringify({
        reportId: careerOsPlan115Import.reports[0].reportId,
        generatedAt: careerOsPlan115Import.reports[0].generatedAt,
        topics: [{
          topicKey: careerOsPlan115Import.reports[0].topics[0].topicKey,
          title: careerOsPlan115Import.reports[0].topics[0].title,
          careerQuestion: null,
          items: [{
            materialId: material.id,
            contentKey: material.contentKey,
            title: material.title,
            canonicalUrl: material.canonicalUrl,
            summary: null,
            reason: null,
            careerValue: null,
            state,
          }],
        }],
        publications: [],
      }));
      return;
    }
    if (path === "/imports/dry-run" && request.method === "POST") {
      response.writeHead(200).end(JSON.stringify({
        previewHash: PREVIEW_HASH, historyVersion: 4, counts, warnings: [],
      }));
      return;
    }
    if (path === "/imports/commit" && request.method === "POST") {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as ImportCommitRequest;
        if (body.previewHash !== PREVIEW_HASH || body.expectedHistoryVersion !== 4) {
          response.writeHead(409).end(errorBody("IMPORT_CHANGED", "미리보기 이후 이력이 변경되었습니다."));
          return;
        }
        response.writeHead(200).end(JSON.stringify({ importKey: body.importKey, counts, historyVersion: 5 }));
      });
      return;
    }
    response.writeHead(503).end(errorBody("UNAVAILABLE", "지원하지 않는 요청입니다."));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function admin() {
  return { baseUrl, token: ADMIN_TOKEN };
}

describe("career-os Backend 계약과 fos-blog 소비측 호환", () => {
  it("자료 목록과 단건을 기존 DTO 그대로 읽는다", async () => {
    await expect(listStudyMaterials({ limit: 30 }, admin())).resolves.toEqual({ items: [material], nextCursor: null });
    await expect(listStudyMaterials({ recommended: false }, admin())).resolves.toEqual({ items: [], nextCursor: null });
    await expect(getStudyMaterial(7, admin())).resolves.toEqual(material);
  });

  it("YouTube URL 식별 결과를 그대로 읽고 nullable 설명 필드를 보존한다", async () => {
    const report = await getStudyRecommendationRun(careerOsPlan115Import.reports[0].reportId, admin());
    const item = report.topics[0].items[0];
    expect(item.contentKey).toBe(careerOsPlan115UrlIdentity.contentKey);
    expect(item.canonicalUrl).toBe(careerOsPlan115UrlIdentity.canonicalUrl);
    expect(item.summary).toBeNull();
    expect(item.reason).toBeNull();
    expect(item.careerValue).toBeNull();
    expect(report.topics[0].careerQuestion).toBeNull();
  });

  it("기존 이력 fixture 의 dry-run 과 commit 이 previewHash 와 이력 version 으로 이어진다", async () => {
    const preview = await dryRunStudyImport(careerOsPlan115Import, admin());
    expect(preview.previewHash).toBe(PREVIEW_HASH);
    const committed = await commitStudyImport({
      ...careerOsPlan115Import,
      previewHash: preview.previewHash,
      expectedHistoryVersion: preview.historyVersion,
    }, admin());
    expect(committed).toEqual({ importKey: careerOsPlan115Import.importKey, counts, historyVersion: 5 });
  });

  it("오래된 previewHash 는 IMPORT_CHANGED 로 돌아온다", async () => {
    await expect(commitStudyImport({
      ...careerOsPlan115Import,
      previewHash: "c".repeat(64),
      expectedHistoryVersion: 4,
    }, admin())).rejects.toMatchObject({ status: 409, code: "IMPORT_CHANGED" });
  });

  it("오래된 version 의 상태 수정은 409, 없는 자료는 404 다", async () => {
    await expect(updateStudyMaterialState(7, { expectedVersion: 3, starred: true }, admin()))
      .resolves.toMatchObject({ starred: true, version: 4 });
    await expect(updateStudyMaterialState(7, { expectedVersion: 1, starred: true }, admin()))
      .rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
    await expect(getStudyMaterial(404, admin())).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("producer token 으로는 관리자 동작을 수행할 수 없다", async () => {
    const producer = { baseUrl, token: PRODUCER_TOKEN };
    await expect(getStudyMaterial(7, producer)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    await expect(commitStudyImport({
      ...careerOsPlan115Import,
      previewHash: PREVIEW_HASH,
      expectedHistoryVersion: 4,
    }, producer)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("인증하지 않은 요청은 401 이다", async () => {
    await expect(getStudyMaterial(7, { baseUrl, token: "wrong-token-that-is-at-least-32-bytes-long" }))
      .rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
  });
});
