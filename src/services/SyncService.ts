import { PostRepository } from "@/infra/db/repositories/PostRepository";
import { SyncLogRepository } from "@/infra/db/repositories/SyncLogRepository";
import { extractDescription, extractTitle, parseFrontMatter } from "@/lib/markdown";

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  return Array.from(new Set(cleaned));
}
import {
  type ChangedFile,
  type getChangedFilesSince,
  type getCurrentHeadSha,
  type getDirectoryContents,
  type getFileCommitDates,
  type getFileContent,
} from "@/infra/github/api";
import { shouldSyncFile } from "@/infra/github/file-filter";
import { rewriteImagePaths } from "@/infra/github/image-rewrite";
import { PostSyncService, parsePath } from "./PostSyncService";
import { MetadataSyncService } from "./MetadataSyncService";
import { PostService } from "./PostService";
import logger from "@/lib/logger";

const log = logger.child({ module: "SyncService" });

type GithubApi = {
  getCurrentHeadSha: typeof getCurrentHeadSha;
  getChangedFilesSince: typeof getChangedFilesSince;
  getDirectoryContents: typeof getDirectoryContents;
  getFileContent: typeof getFileContent;
  getFileCommitDates: typeof getFileCommitDates;
};

export class SyncService {
  constructor(
    private postSyncService: PostSyncService,
    private metadataSyncService: MetadataSyncService,
    private postService: PostService,
    private postRepo: PostRepository,
    private syncLogRepo: SyncLogRepository,
    private githubApi: GithubApi,
  ) {}

  async sync(): Promise<{
    added: number;
    updated: number;
    deleted: number;
    commitSha: string;
    upToDate?: boolean;
    titles: { total: number; updated: number; skipped: number };
  }> {
    log.info("GitHub → Database 동기화 시작...");

    let added = 0,
      updated = 0,
      deleted = 0;

    try {
      const headSha = await this.githubApi.getCurrentHeadSha();
      const lastSyncedSha = (await this.syncLogRepo.getLatest())?.commitSha;

      log.info({ headSha: headSha.slice(0, 7) }, `현재 HEAD: ${headSha.slice(0, 7)}`);
      log.info(
        { lastSyncedSha: lastSyncedSha?.slice(0, 7) ?? null },
        `마지막 sync: ${lastSyncedSha ? lastSyncedSha.slice(0, 7) : "없음 (최초 sync)"}`,
      );

      if (lastSyncedSha === headSha) {
        log.info("이미 최신 상태입니다.");
        const titles = await this.postService.retitleAll();
        return {
          added: 0,
          updated: 0,
          deleted: 0,
          commitSha: headSha,
          upToDate: true,
          titles,
        };
      }

      if (!lastSyncedSha) {
        log.info("최초 sync — 전체 동기화 수행");
        ({ added, updated, deleted } = await this.performFullSync());
      } else {
        const changedFiles = await this.githubApi.getChangedFilesSince(
          lastSyncedSha,
          headSha,
        );
        if (changedFiles === null) {
          log.info("전체 동기화 폴백 수행");
          ({ added, updated, deleted } = await this.performFullSync());
        } else {
          log.info(
            { changedCount: changedFiles.length },
            `변경 파일 ${changedFiles.length}개에 대해 증분 동기화 수행`,
          );
          ({ added, updated, deleted } =
            await this.performIncrementalSync(changedFiles));
        }
      }

      await this.metadataSyncService.updateCategories();
      await this.metadataSyncService.syncFolderReadmes();
      const titles = await this.postService.retitleAll();

      await this.syncLogRepo.create({
        status: "success",
        postsAdded: added,
        postsUpdated: updated,
        postsDeleted: deleted,
        commitSha: headSha,
      });

      log.info(
        { added, updated, deleted, commitSha: headSha.slice(0, 7) },
        `동기화 완료: ${added}개 추가, ${updated}개 업데이트, ${deleted}개 삭제 (commit: ${headSha.slice(0, 7)})`,
      );
      return { added, updated, deleted, commitSha: headSha, titles };
    } catch (error) {
      log.error({ err: error instanceof Error ? error : new Error(String(error)) }, "동기화 실패");

      await this.syncLogRepo.create({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  private async performFullSync(): Promise<{
    added: number;
    updated: number;
    deleted: number;
  }> {
    let added = 0,
      updated = 0,
      deleted = 0;

    const githubFiles = await this.collectMarkdownFiles();
    log.info({ count: githubFiles.length }, `GitHub에서 마크다운 파일 ${githubFiles.length}개 발견`);

    const existingPosts = await this.postRepo.getAllForSync();
    const existingPathMap = new Map(existingPosts.map((p) => [p.path, p]));
    const processedPaths = new Set<string>();

    for (const file of githubFiles) {
      processedPaths.add(file.path);
      const existing = existingPathMap.get(file.path);

      if (existing && existing.sha === file.sha) continue;

      const [fileData, commitDates] = await Promise.all([
        this.githubApi.getFileContent(file.path),
        this.githubApi.getFileCommitDates(file.path),
      ]);
      if (!fileData) continue;

      const { title: filenameTitle } = parsePath(file.path);
      const content = rewriteImagePaths(fileData.content, file.path);
      const title = extractTitle(content) || filenameTitle;
      const description = extractDescription(content, 200);
      const { frontMatter } = parseFrontMatter(content);
      const tags = normalizeTags(frontMatter.tags);

      if (existing) {
        await this.postRepo.update(existing.id, {
          title,
          content,
          description,
          sha: fileData.sha,
          category: file.category,
          subcategory: file.subcategory,
          folders: file.folders,
          tags,
          isActive: true,
          updatedAt: commitDates?.updatedAt ?? new Date(),
        });
        updated++;
        log.info({ path: file.path }, `업데이트: ${file.path}`);
      } else {
        await this.postRepo.create({
          title,
          path: file.path,
          slug: file.path,
          category: file.category,
          subcategory: file.subcategory,
          folders: file.folders,
          tags,
          content,
          description,
          sha: fileData.sha,
          ...(commitDates && {
            createdAt: commitDates.createdAt,
            updatedAt: commitDates.updatedAt,
          }),
        });
        added++;
        log.info({ path: file.path }, `추가: ${file.path}`);
      }
    }

    const idsToDeactivate = existingPosts
      .filter((p) => !processedPaths.has(p.path) && p.isActive)
      .map((p) => p.id);
    deleted = await this.postRepo.deactivateByIds(idsToDeactivate);
    if (deleted > 0) log.info({ deleted }, `비활성화 완료: ${deleted}개`);

    return { added, updated, deleted };
  }

  private async performIncrementalSync(changedFiles: ChangedFile[]): Promise<{
    added: number;
    updated: number;
    deleted: number;
  }> {
    let added = 0,
      updated = 0,
      deleted = 0;

    for (const file of changedFiles) {
      if (file.status === "removed") {
        if (shouldSyncFile(file.filename)) {
          const ok = await this.postRepo.deactive(file.filename);
          if (ok) deleted++;
          log.info({ filename: file.filename }, `삭제: ${file.filename}`);
        }
      } else if (file.status === "renamed") {
        if (file.previous_filename && shouldSyncFile(file.previous_filename)) {
          const ok = await this.postRepo.deactive(file.previous_filename);
          if (ok) deleted++;
          log.info({ filename: file.previous_filename }, `이름 변경(삭제): ${file.previous_filename}`);
        }
        if (shouldSyncFile(file.filename)) {
          const result = await this.postSyncService.upsert(file.filename);
          if (result === "added") added++;
          else if (result === "updated") updated++;
          log.info({ filename: file.filename, result }, `이름 변경(추가): ${file.filename} → ${result}`);
        }
      } else {
        if (shouldSyncFile(file.filename)) {
          const result = await this.postSyncService.upsert(file.filename);
          if (result === "added") added++;
          else if (result === "updated") updated++;
          log.info({ status: file.status, filename: file.filename, result }, `${file.status}: ${file.filename} → ${result}`);
        }
      }
    }

    return { added, updated, deleted };
  }

  private async collectMarkdownFiles(
    path: string = "",
    files: Array<{
      name: string;
      path: string;
      sha: string;
      category: string;
      subcategory?: string;
      folders: string[];
    }> = [],
  ): Promise<typeof files> {
    const contents = await this.githubApi.getDirectoryContents(path);
    for (const item of contents) {
      if (item.name.startsWith(".")) continue;
      if (item.type === "dir") {
        await this.collectMarkdownFiles(item.path, files);
      } else if (item.type === "file" && shouldSyncFile(item.name)) {
        const { category, foldersList, subcategory } = parsePath(item.path);
        files.push({
          name: item.name,
          path: item.path,
          sha: item.sha,
          category,
          subcategory,
          folders: foldersList,
        });
      }
    }
    return files;
  }
}
