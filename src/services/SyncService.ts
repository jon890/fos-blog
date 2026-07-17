import { SyncLogRepository } from "@/infra/db/repositories/SyncLogRepository";
import type { ChangedFile } from "@/infra/github/api";
import logger from "@/lib/logger";
import type {
  GlossaryDefinitionSyncResult,
  GlossarySyncMode,
} from "./GlossarySyncService";
import { GlossarySyncService } from "./GlossarySyncService";
import { MetadataSyncService } from "./MetadataSyncService";
import { PostSyncService, type PostSyncResult } from "./PostSyncService";

const log = logger.child({ module: "SyncService" });

type GithubApi = {
  getCurrentHeadSha: () => Promise<string>;
  getChangedFilesSince: (
    baseSha: string,
    headSha: string,
  ) => Promise<ChangedFile[] | null>;
};

type PostSync = Pick<
  PostSyncService,
  "retitleAll" | "syncAll" | "syncChanged"
>;
type MetadataSync = Pick<MetadataSyncService, "refresh">;
type GlossarySync = Pick<GlossarySyncService, "syncDefinitions">;
type SyncLogRepo = Pick<SyncLogRepository, "create" | "getLatest">;

export type SyncResult = {
  added: number;
  updated: number;
  deleted: number;
  commitSha: string;
  upToDate?: boolean;
  titles: { total: number; updated: number; skipped: number };
  glossary: GlossaryDefinitionSyncResult & {
    mentions: number;
    pagesReindexed: number;
  };
};

type SyncPlan = {
  mode: GlossarySyncMode;
  changedFiles: ChangedFile[];
};

export class SyncService {
  constructor(
    private postSyncService: PostSync,
    private metadataSyncService: MetadataSync,
    private glossarySyncService: GlossarySync,
    private syncLogRepo: SyncLogRepo,
    private githubApi: GithubApi,
  ) {}

  async sync(): Promise<SyncResult> {
    log.info("GitHub → Database 동기화 시작...");

    try {
      const headSha = await this.githubApi.getCurrentHeadSha();
      const lastSyncedSha = (await this.syncLogRepo.getLatest())?.commitSha;

      log.info(
        { headSha: headSha.slice(0, 7) },
        `현재 HEAD: ${headSha.slice(0, 7)}`,
      );
      log.info(
        { lastSyncedSha: lastSyncedSha?.slice(0, 7) ?? null },
        `마지막 sync: ${lastSyncedSha ? lastSyncedSha.slice(0, 7) : "없음 (최초 sync)"}`,
      );

      if (lastSyncedSha === headSha) {
        log.info("이미 최신 상태 — posts 변경 없음, metadata 만 재계산");
        const glossaryDefinitions =
          await this.glossarySyncService.syncDefinitions("incremental", []);
        await this.metadataSyncService.refresh();
        const titles = await this.postSyncService.retitleAll();
        return {
          added: 0,
          updated: 0,
          deleted: 0,
          commitSha: headSha,
          upToDate: true,
          titles,
          glossary: this.createGlossaryResult(glossaryDefinitions),
        };
      }

      const syncPlan = await this.resolveSyncPlan(lastSyncedSha, headSha);
      const glossaryDefinitions =
        await this.glossarySyncService.syncDefinitions(
          syncPlan.mode,
          syncPlan.changedFiles,
        );
      const postResult = await this.syncPosts(syncPlan);
      await this.metadataSyncService.refresh();

      await this.syncLogRepo.create({
        status: "success",
        postsAdded: postResult.added,
        postsUpdated: postResult.updated,
        postsDeleted: postResult.deleted,
        commitSha: headSha,
      });

      log.info(
        {
          added: postResult.added,
          updated: postResult.updated,
          deleted: postResult.deleted,
          commitSha: headSha.slice(0, 7),
        },
        `동기화 완료: ${postResult.added}개 추가, ${postResult.updated}개 업데이트, ${postResult.deleted}개 삭제 (commit: ${headSha.slice(0, 7)})`,
      );

      return {
        added: postResult.added,
        updated: postResult.updated,
        deleted: postResult.deleted,
        commitSha: headSha,
        titles: postResult.titles,
        glossary: this.createGlossaryResult(glossaryDefinitions),
      };
    } catch (error) {
      log.error(
        { err: error instanceof Error ? error : new Error(String(error)) },
        "동기화 실패",
      );

      try {
        await this.syncLogRepo.create({
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      } catch (logError) {
        log.error(
          {
            err:
              logError instanceof Error
                ? logError
                : new Error(String(logError)),
          },
          "동기화 실패 기록 저장 실패",
        );
      }

      throw error;
    }
  }

  private async resolveSyncPlan(
    lastSyncedSha: string | null | undefined,
    headSha: string,
  ): Promise<SyncPlan> {
    if (!lastSyncedSha) {
      log.info("최초 sync — 전체 동기화 수행");
      return { mode: "full", changedFiles: [] };
    }

    const changedFiles = await this.githubApi.getChangedFilesSince(
      lastSyncedSha,
      headSha,
    );
    if (changedFiles === null) {
      log.info("전체 동기화 폴백 수행");
      return { mode: "full", changedFiles: [] };
    }

    log.info(
      { changedCount: changedFiles.length },
      `변경 파일 ${changedFiles.length}개에 대해 증분 동기화 수행`,
    );
    return { mode: "incremental", changedFiles };
  }

  private syncPosts(plan: SyncPlan): Promise<PostSyncResult> {
    return plan.mode === "full"
      ? this.postSyncService.syncAll()
      : this.postSyncService.syncChanged(plan.changedFiles);
  }

  private createGlossaryResult(
    definitions: GlossaryDefinitionSyncResult,
  ): SyncResult["glossary"] {
    return {
      ...definitions,
      mentions: 0,
      pagesReindexed: 0,
    };
  }
}
