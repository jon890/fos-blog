import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { StudyRepository } from "@/infra/db/repositories/StudyRepository";
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
} from "@/infra/db/schema";
import { createTestDatabase, getTestDatabaseUrl, migrateTestDatabase } from "@/infra/db/test-utils";
import { StudyAuthError, authorizeStudyRequest } from "@/lib/study/auth";
import { studyContentKey } from "@/lib/study/url-identity";
import { GET as searchPosts } from "@/app/api/search/route";
import {
  careerOsPlan115Import,
  careerOsPlan115LegacyHistory,
  careerOsPlan115UrlIdentity,
} from "./__fixtures__/career-os-plan115";
import { GET as listCandidates } from "./candidates/route";
import { POST as ingest } from "./ingestions/route";
import { POST as commitImport } from "./imports/commit/route";
import { POST as previewImport } from "./imports/dry-run/route";
import { POST as recordPublication } from "./publications/route";
import { GET as getRecommendationRun } from "./recommendation-runs/[reportId]/route";
import {
  GET as listRecommendationRuns,
  POST as saveRecommendationRun,
  PUT as invalidRecommendationMethod,
} from "./recommendation-runs/route";
import { PUT as putSource } from "./sources/[sourceKey]/route";

const repositoryState = vi.hoisted(() => ({
  study: undefined as unknown,
  searchPosts: vi.fn(),
}));
vi.mock("@/infra/db/repositories", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/infra/db/repositories")>(),
  getRepositories: () => ({
    study: repositoryState.study,
    post: { searchPosts: repositoryState.searchPosts },
  }),
}));
vi.mock("@/lib/study/auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/study/auth")>(),
  authorizeStudyRequest: vi.fn(),
}));

const origin = "https://blog.example.test";
const ownerKey = "owner";
const sourceKey = careerOsPlan115Import.reports[0].topics[0].items[0].sourceKey;
const secondaryUrl = "https://example.test/study/secondary";
const secondaryContentKey = studyContentKey(secondaryUrl);
const reportIds = [
  "route-plan064-live",
  "route-plan064-empty",
  careerOsPlan115Import.reports[0].reportId,
];
const receiptKeys = [
  "route-plan064-ingestion",
  "route-plan064-publication",
  careerOsPlan115Import.importKey,
];
const contentKeys = [careerOsPlan115UrlIdentity.contentKey, secondaryContentKey];
const serviceHeaders = { authorization: "Bearer fixture", "content-type": "application/json" };
const adminHeaders = { origin, "content-type": "application/json" };
const sourceContext = { params: Promise.resolve({ sourceKey }) };
const reportContext = (reportId: string) => ({ params: Promise.resolve({ reportId }) });
const jsonRequest = (path: string, method: string, body: unknown, headers: HeadersInit) =>
  new Request(`${origin}/api/study/v1/${path}`, { method, headers, body: JSON.stringify(body) });

function expectPrivate(response: Response): void {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
}

describe("추천 Route HTTP 경계", () => {
  beforeEach(() => {
    vi.mocked(authorizeStudyRequest).mockResolvedValue({ kind: "admin", ownerKey });
  });

  it("미지원 메서드와 인증 오류를 공통 envelope와 개인 응답 헤더로 반환한다", async () => {
    const method = invalidRecommendationMethod();
    expect(method.status).toBe(405);
    expect(method.headers.get("allow")).toBe("GET, POST");
    expectPrivate(method);

    vi.mocked(authorizeStudyRequest).mockRejectedValueOnce(
      new StudyAuthError(401, "UNAUTHENTICATED", "서비스 인증이 필요합니다."),
    );
    const response = await listCandidates(new Request(`${origin}/api/study/v1/candidates`));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
    expectPrivate(response);
  });

  it("서비스 주체의 import commit을 거절하고 브라우저 Origin 검사 경로를 사용한다", async () => {
    vi.mocked(authorizeStudyRequest).mockRejectedValueOnce(
      new StudyAuthError(403, "FORBIDDEN", "서비스 주체가 사용할 수 없는 요청입니다."),
    );
    const response = await commitImport(jsonRequest("imports/commit", "POST", {}, serviceHeaders));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(authorizeStudyRequest).toHaveBeenLastCalledWith(expect.any(Request), "admin-write");
  });

  it("알 수 없는 query를 400으로 거절한다", async () => {
    const response = await listCandidates(
      new Request(`${origin}/api/study/v1/candidates?unknown=1`, { headers: serviceHeaders }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
  });
});

describe.skipIf(!getTestDatabaseUrl())("추천 Route 실제 MySQL 흐름", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;

  async function cleanup(): Promise<void> {
    await fixture.db.delete(studyRequestReceipts).where(inArray(studyRequestReceipts.requestKey, receiptKeys));
    await fixture.db.delete(studyRecommendationControl).where(eq(studyRecommendationControl.ownerKey, ownerKey));

    const runs = await fixture.db
      .select({ id: studyRecommendationRuns.id })
      .from(studyRecommendationRuns)
      .where(inArray(studyRecommendationRuns.reportId, reportIds));
    const runIds = runs.map(({ id }) => id);
    if (runIds.length > 0) {
      await fixture.db.delete(studyPublications).where(inArray(studyPublications.runId, runIds));
      await fixture.db.delete(studyRecommendationItems).where(inArray(studyRecommendationItems.runId, runIds));
      await fixture.db.delete(studyRecommendedMaterials).where(inArray(studyRecommendedMaterials.firstRunId, runIds));
      await fixture.db.delete(studyRecommendationTopics).where(inArray(studyRecommendationTopics.runId, runIds));
      await fixture.db.delete(studyRecommendationRuns).where(inArray(studyRecommendationRuns.id, runIds));
    }

    const materials = await fixture.db
      .select({ id: studyMaterials.id })
      .from(studyMaterials)
      .where(inArray(studyMaterials.contentKey, contentKeys));
    const materialIds = materials.map(({ id }) => id);
    if (materialIds.length > 0) {
      await fixture.db.delete(studyRecommendedMaterials).where(inArray(studyRecommendedMaterials.materialId, materialIds));
      await fixture.db.delete(studyMaterialStates).where(inArray(studyMaterialStates.materialId, materialIds));
      await fixture.db.delete(studyMaterialTags).where(inArray(studyMaterialTags.materialId, materialIds));
      await fixture.db.delete(studyMaterialSources).where(inArray(studyMaterialSources.materialId, materialIds));
      await fixture.db.delete(studyMaterials).where(inArray(studyMaterials.id, materialIds));
    }
    await fixture.db.delete(studySourceCursors).where(eq(studySourceCursors.sourceKey, sourceKey));
    await fixture.db.delete(studySources).where(eq(studySources.sourceKey, sourceKey));
  }

  beforeAll(async () => {
    fixture = await createTestDatabase();
    await migrateTestDatabase(fixture);
    repositoryState.study = new StudyRepository(fixture.db);
  });

  beforeEach(async () => {
    vi.mocked(authorizeStudyRequest).mockResolvedValue({ kind: "service" });
    repositoryState.searchPosts.mockReset();
    await cleanup();
  });

  afterAll(async () => {
    if (!fixture) return;
    await cleanup();
    await fixture.connection.end();
  });

  it("수집부터 후보·추천·게시·가져오기와 관리자 조회까지 같은 DTO로 연결한다", async () => {
    const sourceResponse = await putSource(jsonRequest(`sources/${sourceKey}`, "PUT", {
      title: "Career OS video", category: "video", url: "https://www.youtube.com", feedUrl: null,
      adapter: "youtube", enabled: true, expectedVersion: 0,
    }, serviceHeaders), sourceContext);
    expect(sourceResponse.status).toBe(200);

    const ingestion = await ingest(jsonRequest("ingestions", "POST", {
      sourceKey,
      mode: "recent",
      items: [
        {
          contentKey: careerOsPlan115UrlIdentity.contentKey,
          canonicalUrl: careerOsPlan115UrlIdentity.canonicalUrl,
          url: careerOsPlan115UrlIdentity.inputs[0],
          title: "Career OS recommendation video",
          published: "2026-09-08",
          publishedAt: "2026-09-08T00:00:00.000Z",
          excerpt: null,
          kind: "page-video",
          tags: ["backend"],
          collectedAt: "2026-09-08T01:00:00.000Z",
        },
        {
          contentKey: secondaryContentKey,
          canonicalUrl: secondaryUrl,
          url: secondaryUrl,
          title: "Secondary material",
          published: "",
          publishedAt: null,
          excerpt: "후보 페이지 구분용 자료",
          kind: "page-link",
          tags: [],
          collectedAt: "2026-09-08T01:00:00.000Z",
        },
      ],
      cursor: null,
      expectedCursorVersion: 0,
      idempotencyKey: receiptKeys[0],
    }, serviceHeaders));
    expect(ingestion.status).toBe(200);

    const firstPageResponse = await listCandidates(
      new Request(`${origin}/api/study/v1/candidates?limit=1`, { headers: serviceHeaders }),
    );
    const firstPage = await firstPageResponse.json();
    expect(firstPage).toMatchObject({ recentStudyTopicKeys: [], historyVersion: 0 });
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    expect(firstPage.nextCursor).not.toMatch(/^\d+$/);
    const secondPageResponse = await listCandidates(new Request(
      `${origin}/api/study/v1/candidates?limit=1&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
      { headers: serviceHeaders },
    ));
    const candidates = [...firstPage.candidates, ...(await secondPageResponse.json()).candidates];
    const youtubeCandidate = candidates.find(({ contentKey }: { contentKey: string }) =>
      contentKey === careerOsPlan115UrlIdentity.contentKey);
    expect(youtubeCandidate).toMatchObject({
      id: careerOsPlan115UrlIdentity.contentKey,
      contentKey: careerOsPlan115UrlIdentity.contentKey,
      canonicalUrl: careerOsPlan115UrlIdentity.canonicalUrl,
      previouslyRecommended: false,
    });
    expect(typeof youtubeCandidate.id).toBe("string");
    expect(youtubeCandidate).not.toHaveProperty("excerpt");
    expect(studyContentKey(careerOsPlan115UrlIdentity.inputs[0])).toBe(careerOsPlan115UrlIdentity.contentKey);
    expect(studyContentKey(careerOsPlan115UrlIdentity.inputs[1])).toBe(careerOsPlan115UrlIdentity.contentKey);

    const liveReport = {
      reportId: reportIds[0],
      generatedAt: "2026-09-08T02:00:00.000Z",
      topics: [{
        topicKey: "backend-video",
        title: "백엔드 학습 영상",
        careerQuestion: "이 자료를 현재 업무에 어떻게 적용할 수 있는가?",
        items: [{
          contentKey: careerOsPlan115UrlIdentity.contentKey,
          summary: "추천 시점 요약",
          reason: "추천 시점 이유",
          careerValue: "current-work",
        }],
      }],
    };
    const saved = await saveRecommendationRun(
      jsonRequest("recommendation-runs", "POST", liveReport, serviceHeaders),
    );
    expect(await saved.json()).toEqual({ reportId: reportIds[0], historyVersion: 1 });

    const publicationBody = {
      idempotencyKey: receiptKeys[1], reportId: reportIds[0], channel: "dooray",
      publishedAt: "2026-09-08T03:00:00.000Z", externalId: "task-plan064", url: null,
    };
    const firstPublication = await recordPublication(
      jsonRequest("publications", "POST", publicationBody, serviceHeaders),
    );
    const repeatedPublication = await recordPublication(
      jsonRequest("publications", "POST", publicationBody, serviceHeaders),
    );
    const publicationReceipt = await firstPublication.json();
    expect(await repeatedPublication.json()).toEqual(publicationReceipt);

    vi.mocked(authorizeStudyRequest).mockResolvedValue({ kind: "admin", ownerKey });
    const historyResponse = await listRecommendationRuns(
      new Request(`${origin}/api/study/v1/recommendation-runs?limit=10`),
    );
    expect((await historyResponse.json()).items).toEqual(expect.arrayContaining([
      expect.objectContaining({ reportId: reportIds[0], topicCount: 1 }),
    ]));
    const liveDetailResponse = await getRecommendationRun(
      new Request(`${origin}/api/study/v1/recommendation-runs/${reportIds[0]}`),
      reportContext(reportIds[0]),
    );
    const liveDetail = await liveDetailResponse.json();
    expect(liveDetail.topics[0].items[0]).toMatchObject({
      title: "Career OS recommendation video",
      summary: "추천 시점 요약",
      state: { starred: false, read: false, note: "", version: 0, updatedAt: null },
    });
    expect(liveDetail.publications).toEqual([expect.objectContaining(publicationReceipt)]);

    expect(careerOsPlan115LegacyHistory.reports[0].entries[0].studyTopicKey)
      .toBe(careerOsPlan115Import.reports[0].topics[0].topicKey);
    const previewResponse = await previewImport(
      jsonRequest("imports/dry-run", "POST", careerOsPlan115Import, adminHeaders),
    );
    const preview = await previewResponse.json();
    expect(preview).toMatchObject({ historyVersion: 1, counts: { reports: 1, items: 1 } });

    vi.mocked(authorizeStudyRequest).mockResolvedValue({ kind: "service" });
    await saveRecommendationRun(jsonRequest("recommendation-runs", "POST", {
      reportId: reportIds[1], generatedAt: "2026-09-08T04:00:00.000Z", topics: [],
    }, serviceHeaders));

    vi.mocked(authorizeStudyRequest).mockResolvedValue({ kind: "admin", ownerKey });
    const staleCommit = await commitImport(jsonRequest("imports/commit", "POST", {
      ...careerOsPlan115Import,
      previewHash: preview.previewHash,
      expectedHistoryVersion: preview.historyVersion,
    }, adminHeaders));
    expect(staleCommit.status).toBe(409);
    expect(await staleCommit.json()).toMatchObject({ error: { code: "IMPORT_CHANGED" } });

    const currentPreview = await previewImport(
      jsonRequest("imports/dry-run", "POST", careerOsPlan115Import, adminHeaders),
    ).then((response) => response.json());
    const importRequest = {
      ...careerOsPlan115Import,
      previewHash: currentPreview.previewHash,
      expectedHistoryVersion: currentPreview.historyVersion,
    };
    const committedResponse = await commitImport(
      jsonRequest("imports/commit", "POST", importRequest, adminHeaders),
    );
    const committed = await committedResponse.json();
    expect(committed).toMatchObject({ importKey: careerOsPlan115Import.importKey, historyVersion: 3 });
    const repeatedCommit = await commitImport(
      jsonRequest("imports/commit", "POST", importRequest, adminHeaders),
    );
    expect(await repeatedCommit.json()).toEqual(committed);

    const importedDetail = await getRecommendationRun(
      new Request(`${origin}/api/study/v1/recommendation-runs/${reportIds[2]}`),
      reportContext(reportIds[2]),
    ).then((response) => response.json());
    expect(importedDetail.topics[0]).toMatchObject({
      careerQuestion: null,
      items: [{ summary: null, reason: null, careerValue: null }],
    });

    vi.mocked(authorizeStudyRequest).mockResolvedValue({ kind: "service" });
    const candidatesAfterEmptyRun = await listCandidates(
      new Request(`${origin}/api/study/v1/candidates?limit=100`, { headers: serviceHeaders }),
    ).then((response) => response.json());
    expect(candidatesAfterEmptyRun.recentStudyTopicKeys).toEqual([]);
    expect(candidatesAfterEmptyRun.candidates.find(
      ({ contentKey }: { contentKey: string }) => contentKey === careerOsPlan115UrlIdentity.contentKey,
    )).toMatchObject({ previouslyRecommended: true });

    repositoryState.searchPosts.mockResolvedValue([{ id: 1, title: "Public post" }]);
    const searchResponse = await searchPosts(new NextRequest(`${origin}/api/search?q=Career`));
    const searchBody = await searchResponse.json();
    expect(searchBody.results).toEqual([{ id: 1, title: "Public post" }]);
    expect(searchBody.results).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Career OS recommendation video" }),
    ]));

    for (const response of [sourceResponse, ingestion, firstPageResponse, secondPageResponse, saved,
      firstPublication, repeatedPublication, historyResponse, liveDetailResponse, previewResponse,
      committedResponse, repeatedCommit, searchResponse]) {
      if (response === searchResponse) continue;
      expectPrivate(response);
    }
  });
});
