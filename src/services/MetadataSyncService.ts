import { CategoryRepository } from "@/infra/db/repositories/CategoryRepository";
import { FolderRepository } from "@/infra/db/repositories/FolderRepository";
import { PostRepository } from "@/infra/db/repositories/PostRepository";
import { categoryIcons } from "@/infra/db/constants";
import type { getFileContent } from "@/infra/github/api";
import logger from "@/lib/logger";

const log = logger.child({ module: "MetadataSyncService" });

type GithubApi = {
  getFileContent: typeof getFileContent;
};

export class MetadataSyncService {
  constructor(
    private categoryRepo: CategoryRepository,
    private folderRepo: FolderRepository,
    private postRepo: PostRepository,
    private githubApi: GithubApi,
  ) {}

  async updateCategories(): Promise<void> {
    const stats = await this.postRepo.getCategoryStats();
    await this.categoryRepo.syncAll(
      stats.map((s) => ({
        name: s.category,
        slug: s.category,
        icon: categoryIcons[s.category] || "📁",
        postCount: s.count,
      })),
    );
  }

  async syncFolderReadmes(): Promise<void> {
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

    for (const folderPath of folderPaths) {
      let readmeContent: { content: string; sha: string } | null = null;
      for (const readmeName of readmeNames) {
        const result = await this.githubApi.getFileContent(
          `${folderPath}/${readmeName}`,
        );
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
        synced++;
        log.info({ folderPath }, `README 동기화: ${folderPath}`);
      } else {
        await this.folderRepo.ensureFolder(folderPath);
      }
    }

    log.info({ synced }, `폴더 README ${synced}개 동기화 완료`);
  }
}
