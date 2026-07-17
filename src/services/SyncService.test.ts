import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncLog } from "@/infra/db/schema/syncLogs";
import type { ChangedFile } from "@/infra/github/api";
import { SyncService } from "./SyncService";

const emptyTitles = { total: 0, updated: 0, skipped: 0 };

function makeMocks() {
  const postSyncService: ConstructorParameters<typeof SyncService>[0] = {
    syncAll: vi.fn().mockResolvedValue({
      added: 1,
      updated: 0,
      deleted: 0,
      changedPosts: [{ path: "AI/intro.md", operation: "upsert" }],
      titles: emptyTitles,
    }),
    syncChanged: vi.fn().mockResolvedValue({
      added: 0,
      updated: 1,
      deleted: 0,
      changedPosts: [{ path: "AI/intro.md", operation: "upsert" }],
      titles: emptyTitles,
    }),
    retitleAll: vi.fn().mockResolvedValue(emptyTitles),
  };
  const metadataSyncService: ConstructorParameters<typeof SyncService>[1] = {
    refresh: vi.fn().mockResolvedValue({ changedReadmes: [] }),
  };
  const syncLogRepo: ConstructorParameters<typeof SyncService>[2] = {
    getLatest: vi.fn(),
    create: vi.fn().mockResolvedValue(undefined),
  };
  const githubApi: ConstructorParameters<typeof SyncService>[3] = {
    getCurrentHeadSha: vi.fn(),
    getChangedFilesSince: vi.fn(),
  };

  return { postSyncService, metadataSyncService, syncLogRepo, githubApi };
}

function createService(mocks: ReturnType<typeof makeMocks>): SyncService {
  return new SyncService(
    mocks.postSyncService,
    mocks.metadataSyncService,
    mocks.syncLogRepo,
    mocks.githubApi,
  );
}

describe("SyncService.sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("첫 sync는 PostSyncService.syncAll()을 호출한다", async () => {
    const mocks = makeMocks();
    vi.mocked(mocks.githubApi.getCurrentHeadSha).mockResolvedValue("head-sha");
    vi.mocked(mocks.syncLogRepo.getLatest).mockResolvedValue(null);

    const result = await createService(mocks).sync();

    expect(mocks.postSyncService.syncAll).toHaveBeenCalledOnce();
    expect(mocks.postSyncService.syncChanged).not.toHaveBeenCalled();
    expect(result).toMatchObject({ added: 1, commitSha: "head-sha" });
  });

  it("compare 실패의 null은 full sync로 폴백한다", async () => {
    const mocks = makeMocks();
    vi.mocked(mocks.githubApi.getCurrentHeadSha).mockResolvedValue("head-sha");
    vi.mocked(mocks.syncLogRepo.getLatest).mockResolvedValue({
      commitSha: "old-sha",
    } as SyncLog);
    vi.mocked(mocks.githubApi.getChangedFilesSince).mockResolvedValue(null);

    await createService(mocks).sync();

    expect(mocks.postSyncService.syncAll).toHaveBeenCalledOnce();
    expect(mocks.postSyncService.syncChanged).not.toHaveBeenCalled();
  });

  it("incremental은 syncChanged()에 변경 목록을 전달한다", async () => {
    const mocks = makeMocks();
    const changedFiles: ChangedFile[] = [
      { status: "modified", filename: "AI/intro.md" },
    ];
    vi.mocked(mocks.githubApi.getCurrentHeadSha).mockResolvedValue("head-sha");
    vi.mocked(mocks.syncLogRepo.getLatest).mockResolvedValue({
      commitSha: "old-sha",
    } as SyncLog);
    vi.mocked(mocks.githubApi.getChangedFilesSince).mockResolvedValue(changedFiles);

    await createService(mocks).sync();

    expect(mocks.postSyncService.syncChanged).toHaveBeenCalledWith(changedFiles);
    expect(mocks.metadataSyncService.refresh).toHaveBeenCalledOnce();
  });

  it("HEAD가 같아도 metadata를 갱신하고 title 보정을 유지한다", async () => {
    const mocks = makeMocks();
    vi.mocked(mocks.githubApi.getCurrentHeadSha).mockResolvedValue("same-sha");
    vi.mocked(mocks.syncLogRepo.getLatest).mockResolvedValue({
      commitSha: "same-sha",
    } as SyncLog);

    const result = await createService(mocks).sync();

    expect(result.upToDate).toBe(true);
    expect(mocks.metadataSyncService.refresh).toHaveBeenCalledOnce();
    expect(mocks.postSyncService.retitleAll).toHaveBeenCalledOnce();
    expect(mocks.syncLogRepo.create).not.toHaveBeenCalled();
  });

  it("실패 log를 남기고 원래 error를 다시 던진다", async () => {
    const mocks = makeMocks();
    const error = new Error("GitHub API 오류");
    vi.mocked(mocks.githubApi.getCurrentHeadSha).mockRejectedValue(error);

    await expect(createService(mocks).sync()).rejects.toBe(error);
    expect(mocks.syncLogRepo.create).toHaveBeenCalledWith({
      status: "failed",
      error: "GitHub API 오류",
    });
  });

  it("failed log 저장도 실패하면 원래 sync error를 다시 던진다", async () => {
    const mocks = makeMocks();
    const error = new Error("원래 오류");
    vi.mocked(mocks.githubApi.getCurrentHeadSha).mockRejectedValue(error);
    vi.mocked(mocks.syncLogRepo.create).mockRejectedValue(new Error("log 오류"));

    await expect(createService(mocks).sync()).rejects.toBe(error);
  });
});
