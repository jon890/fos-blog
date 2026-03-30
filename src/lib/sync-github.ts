import { SyncLogRepository } from "@/db/repositories/SyncLogRepository";
import { PostRepository } from "@/db/repositories/PostRepository";
import { getDb } from "@/db";
import { getChangedFilesSince, getCurrentHeadSha } from "./github/api";
import { syncFolderReadmes, updateCategories } from "./github/metadata-sync";
import {
  performFullSync,
  performIncrementalSync,
} from "./github/sync-strategies";

export async function syncGitHubToDatabase(): Promise<{
  added: number;
  updated: number;
  deleted: number;
  commitSha: string;
  upToDate?: boolean;
}> {
  console.log("GitHub → Database 동기화 시작...");
  const db = getDb();
  const syncLogRepository = new SyncLogRepository(db);

  let added = 0,
    updated = 0,
    deleted = 0;

  try {
    const headSha = await getCurrentHeadSha();
    const lastSyncedSha = (await syncLogRepository.getLatest())?.commitSha;

    console.log(`현재 HEAD: ${headSha.slice(0, 7)}`);
    console.log(
      `마지막 sync: ${lastSyncedSha ? lastSyncedSha.slice(0, 7) : "없음 (최초 sync)"}`,
    );

    if (lastSyncedSha === headSha) {
      console.log("이미 최신 상태입니다.");
      return {
        added: 0,
        updated: 0,
        deleted: 0,
        commitSha: headSha,
        upToDate: true,
      };
    }

    if (!lastSyncedSha) {
      console.log("최초 sync — 전체 동기화 수행");
      ({ added, updated, deleted } = await performFullSync());
    } else {
      const changedFiles = await getChangedFilesSince(lastSyncedSha, headSha);
      if (changedFiles === null) {
        console.log("전체 동기화 폴백 수행");
        ({ added, updated, deleted } = await performFullSync());
      } else {
        console.log(
          `변경 파일 ${changedFiles.length}개에 대해 증분 동기화 수행`,
        );
        ({ added, updated, deleted } =
          await performIncrementalSync(changedFiles));
      }
    }

    await updateCategories();
    await syncFolderReadmes();

    await syncLogRepository.create({
      status: "success",
      postsAdded: added,
      postsUpdated: updated,
      postsDeleted: deleted,
      commitSha: headSha,
    });

    console.log(
      `동기화 완료: ${added}개 추가, ${updated}개 업데이트, ${deleted}개 삭제 (commit: ${headSha.slice(0, 7)})`,
    );
    return { added, updated, deleted, commitSha: headSha };
  } catch (error) {
    console.error("동기화 실패:", error);

    await syncLogRepository.create({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

export async function retitleExistingPosts(): Promise<{
  total: number;
  updated: number;
  skipped: number;
}> {
  const postRepository = new PostRepository(getDb());
  return postRepository.retitleAll();
}
