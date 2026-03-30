import { desc, eq } from "drizzle-orm";
import { posts, syncLogs } from "@/db/schema";
import { extractTitle } from "./markdown";
import { getDb } from "./github/client";
import { getCurrentHeadSha, getChangedFilesSince } from "./github/api";
import { performFullSync, performIncrementalSync } from "./github/sync-strategies";
import { updateCategories, syncFolderReadmes } from "./github/metadata-sync";

export async function getLastSyncedCommitSha(): Promise<string | null> {
  const database = getDb();
  const result = await database
    .select({ commitSha: syncLogs.commitSha })
    .from(syncLogs)
    .where(eq(syncLogs.status, "success"))
    .orderBy(desc(syncLogs.syncedAt))
    .limit(1);
  return result[0]?.commitSha ?? null;
}

export async function syncGitHubToDatabase(): Promise<{
  added: number;
  updated: number;
  deleted: number;
  commitSha: string;
  upToDate?: boolean;
}> {
  console.log("GitHub → Database 동기화 시작...");
  const database = getDb();

  let added = 0, updated = 0, deleted = 0;

  try {
    const headSha = await getCurrentHeadSha();
    const lastSyncedSha = await getLastSyncedCommitSha();

    console.log(`현재 HEAD: ${headSha.slice(0, 7)}`);
    console.log(`마지막 sync: ${lastSyncedSha ? lastSyncedSha.slice(0, 7) : "없음 (최초 sync)"}`);

    if (lastSyncedSha === headSha) {
      console.log("이미 최신 상태입니다.");
      return { added: 0, updated: 0, deleted: 0, commitSha: headSha, upToDate: true };
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
        console.log(`변경 파일 ${changedFiles.length}개에 대해 증분 동기화 수행`);
        ({ added, updated, deleted } = await performIncrementalSync(changedFiles));
      }
    }

    await updateCategories();
    await syncFolderReadmes();

    await database.insert(syncLogs).values({
      status: "success",
      postsAdded: added,
      postsUpdated: updated,
      postsDeleted: deleted,
      commitSha: headSha,
    });

    console.log(
      `동기화 완료: ${added}개 추가, ${updated}개 업데이트, ${deleted}개 삭제 (commit: ${headSha.slice(0, 7)})`
    );
    return { added, updated, deleted, commitSha: headSha };
  } catch (error) {
    console.error("동기화 실패:", error);
    await database.insert(syncLogs).values({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// DB에 저장된 content에서 h1 제목을 재추출하여 title 일괄 업데이트
// GitHub API 호출 없이 로컬 DB만 사용
export async function retitleExistingPosts(): Promise<{
  total: number;
  updated: number;
  skipped: number;
}> {
  const database = getDb();

  const allPosts = await database
    .select({ path: posts.path, title: posts.title, content: posts.content })
    .from(posts);

  let updated = 0;
  let skipped = 0;

  for (const post of allPosts) {
    if (!post.content) { skipped++; continue; }

    const extractedTitle = extractTitle(post.content);
    if (!extractedTitle || extractedTitle === post.title) { skipped++; continue; }

    await database
      .update(posts)
      .set({ title: extractedTitle })
      .where(eq(posts.path, post.path));

    updated++;
    console.log(`제목 업데이트: ${post.path} → ${extractedTitle}`);
  }

  return { total: allPosts.length, updated, skipped };
}
