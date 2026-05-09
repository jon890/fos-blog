import { describe, expect, it, vi, beforeEach } from "vitest";
import { SyncService } from "./SyncService";
import type { SyncLog } from "@/infra/db/schema/syncLogs";
import type { PostSyncService } from "./PostSyncService";
import type { MetadataSyncService } from "./MetadataSyncService";
import type { PostService } from "./PostService";
import type { PostRepository } from "@/infra/db/repositories/PostRepository";
import type { SyncLogRepository } from "@/infra/db/repositories/SyncLogRepository";
import type {
  getChangedFilesSince,
  getCurrentHeadSha,
  getDirectoryContents,
  getFileCommitDates,
  getFileContent,
} from "@/infra/github/api";

type GithubApi = {
  getCurrentHeadSha: typeof getCurrentHeadSha;
  getChangedFilesSince: typeof getChangedFilesSince;
  getDirectoryContents: typeof getDirectoryContents;
  getFileContent: typeof getFileContent;
  getFileCommitDates: typeof getFileCommitDates;
};

function makeMocks() {
  const postSyncService = {
    upsert: vi.fn(),
  } as unknown as PostSyncService;

  const metadataSyncService = {
    updateCategories: vi.fn().mockResolvedValue(undefined),
    syncFolderReadmes: vi.fn().mockResolvedValue(undefined),
  } as unknown as MetadataSyncService;

  const postService = {
    retitleAll: vi.fn().mockResolvedValue({ total: 0, updated: 0, skipped: 0 }),
  } as unknown as PostService;

  const postRepo = {
    getAllForSync: vi.fn().mockResolvedValue([]),
    deactivateByIds: vi.fn().mockResolvedValue(0),
  } as unknown as PostRepository;

  const syncLogRepo = {
    getLatest: vi.fn(),
    create: vi.fn().mockResolvedValue(undefined),
  } as unknown as SyncLogRepository;

  const githubApi = {
    getCurrentHeadSha: vi.fn(),
    getChangedFilesSince: vi.fn(),
    getDirectoryContents: vi.fn().mockResolvedValue([]),
    getFileContent: vi.fn(),
    getFileCommitDates: vi.fn(),
  } as unknown as GithubApi;

  return { postSyncService, metadataSyncService, postService, postRepo, syncLogRepo, githubApi };
}

describe("SyncService.sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lastSyncedSha === headSha 이면 upToDate: true를 반환한다", async () => {
    const { postSyncService, metadataSyncService, postService, postRepo, syncLogRepo, githubApi } = makeMocks();
    const sha = "abc1234";

    vi.mocked(githubApi.getCurrentHeadSha).mockResolvedValue(sha);
    vi.mocked(syncLogRepo.getLatest).mockResolvedValue({ commitSha: sha } as SyncLog);

    const service = new SyncService(postSyncService, metadataSyncService, postService, postRepo, syncLogRepo, githubApi);
    const result = await service.sync();

    expect(result.upToDate).toBe(true);
    expect(result.commitSha).toBe(sha);
    expect(syncLogRepo.create).not.toHaveBeenCalled();
    expect(metadataSyncService.updateCategories).toHaveBeenCalledTimes(1);
    expect(metadataSyncService.syncFolderReadmes).toHaveBeenCalledTimes(1);
  });

  it("lastSyncedSha가 없으면 performFullSync를 호출한다", async () => {
    const { postSyncService, metadataSyncService, postService, postRepo, syncLogRepo, githubApi } = makeMocks();
    const headSha = "def5678";

    vi.mocked(githubApi.getCurrentHeadSha).mockResolvedValue(headSha);
    vi.mocked(syncLogRepo.getLatest).mockResolvedValue(null);

    const service = new SyncService(postSyncService, metadataSyncService, postService, postRepo, syncLogRepo, githubApi);
    const result = await service.sync();

    // getDirectoryContents가 호출됐으면 performFullSync가 실행된 것
    expect(githubApi.getDirectoryContents).toHaveBeenCalled();
    expect(result.commitSha).toBe(headSha);
    expect(syncLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", commitSha: headSha }),
    );
  });

  it("getChangedFilesSince가 null을 반환하면 performFullSync로 폴백한다", async () => {
    const { postSyncService, metadataSyncService, postService, postRepo, syncLogRepo, githubApi } = makeMocks();
    const headSha = "ghi9012";
    const lastSha = "oldsha";

    vi.mocked(githubApi.getCurrentHeadSha).mockResolvedValue(headSha);
    vi.mocked(syncLogRepo.getLatest).mockResolvedValue({ commitSha: lastSha } as SyncLog);
    vi.mocked(githubApi.getChangedFilesSince).mockResolvedValue(null);

    const service = new SyncService(postSyncService, metadataSyncService, postService, postRepo, syncLogRepo, githubApi);
    await service.sync();

    // getDirectoryContents가 호출됐으면 performFullSync 폴백이 실행된 것
    expect(githubApi.getDirectoryContents).toHaveBeenCalled();
    expect(syncLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success" }),
    );
  });

  it("에러 발생 시 syncLogRepo.create({ status: 'failed' })를 호출하고 에러를 다시 던진다", async () => {
    const { postSyncService, metadataSyncService, postService, postRepo, syncLogRepo, githubApi } = makeMocks();
    const error = new Error("GitHub API 오류");

    vi.mocked(githubApi.getCurrentHeadSha).mockRejectedValue(error);

    const service = new SyncService(postSyncService, metadataSyncService, postService, postRepo, syncLogRepo, githubApi);

    await expect(service.sync()).rejects.toThrow("GitHub API 오류");
    expect(syncLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error: "GitHub API 오류" }),
    );
  });
});
