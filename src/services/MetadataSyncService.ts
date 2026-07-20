import { CategoryRepository } from "@/infra/db/repositories/CategoryRepository";
import { FolderRepository } from "@/infra/db/repositories/FolderRepository";
import { PostRepository } from "@/infra/db/repositories/PostRepository";
import { getCategoryIcon } from "@/infra/db/constants";
import logger from "@/lib/logger";
import type { SyncedPageChange } from "./PostSyncService";

const log = logger.child({ module: "MetadataSyncService" });

type GithubApi = {
  getFileContent: (
    path: string,
  ) => Promise<{ content: string; sha: string } | null>;
};

type CategoryRepo = Pick<CategoryRepository, "syncAll">;
type FolderRepo = Pick<
  FolderRepository,
  "clearReadme" | "ensureFolder" | "getAll" | "upsert"
>;
type PostRepo = Pick<PostRepository, "getAllPostPaths" | "getCategoryStats">;

export type MetadataSyncResult = {
  changedReadmes: SyncedPageChange[];
};

export class MetadataSyncService {
  constructor(
    private categoryRepo: CategoryRepo,
    private folderRepo: FolderRepo,
    private postRepo: PostRepo,
    private githubApi: GithubApi,
  ) {}

  async refresh(): Promise<MetadataSyncResult> {
    await this.updateCategories();
    return { changedReadmes: await this.syncFolderReadmes() };
  }

  private async updateCategories(): Promise<void> {
    const stats = await this.postRepo.getCategoryStats();
    await this.categoryRepo.syncAll(
      stats.map((s) => ({
        name: s.category,
        slug: s.category,
        icon: getCategoryIcon(s.category),
        postCount: s.count,
      })),
    );
  }

  private async syncFolderReadmes(): Promise<SyncedPageChange[]> {
    log.info("폴더 README 동기화 중...");

    const postPaths = await this.postRepo.getAllPostPaths();

    const folderPaths = new Set<string>();
    for (const path of postPaths) {
      const parts = path.split("/");
      for (let i = 1; i <= parts.length - 1; i++) {
        const folderPath = parts.slice(0, i).join("/");
        if (folderPath) folderPaths.add(folderPath);
      }
    }

    const existingFolderMap = await this.folderRepo.getAll();
    const readmeNames = ["README.md", "readme.md", "README.MD", "Readme.md"];
    let synced = 0;
    const changedReadmes: SyncedPageChange[] = [];

    for (const folderPath of folderPaths) {
      let readmeContent: { content: string; sha: string } | null = null;
      const canonicalReadmePath = `${folderPath}/README.md`;
      for (const readmeName of readmeNames) {
        const candidatePath = `${folderPath}/${readmeName}`;
        const result = await this.githubApi.getFileContent(candidatePath);
        if (result) {
          readmeContent = result;
          break;
        }
      }

      const existing = existingFolderMap.get(folderPath);

      if (readmeContent) {
        if (existing && existing.sha === readmeContent.sha) continue;
        await this.folderRepo.upsert(
          folderPath,
          readmeContent.content,
          readmeContent.sha,
        );
        changedReadmes.push({
          path: canonicalReadmePath,
          operation: "upsert",
        });
        synced++;
        log.info({ folderPath }, `README 동기화: ${folderPath}`);
      } else if (existing?.sha) {
        await this.folderRepo.clearReadme(folderPath);
        changedReadmes.push({
          path: canonicalReadmePath,
          operation: "delete",
        });
        log.info({ folderPath }, `README 삭제 반영: ${folderPath}`);
      } else {
        await this.folderRepo.ensureFolder(folderPath);
      }
    }

    for (const [folderPath, existing] of existingFolderMap) {
      if (folderPaths.has(folderPath) || !existing.sha) continue;
      await this.folderRepo.clearReadme(folderPath);
      changedReadmes.push({
        path: `${folderPath}/README.md`,
        operation: "delete",
      });
      log.info({ folderPath }, `소멸한 폴더 README 삭제 반영: ${folderPath}`);
    }

    log.info({ synced }, `폴더 README ${synced}개 동기화 완료`);
    return changedReadmes;
  }
}
