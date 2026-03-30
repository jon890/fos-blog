import { CategoryRepository } from "@/infra/db/repositories/CategoryRepository";
import { FolderRepository } from "@/infra/db/repositories/FolderRepository";
import { PostRepository } from "@/infra/db/repositories/PostRepository";
import type { getFileContent } from "@/infra/github/api";

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
    await this.categoryRepo.rebuild();
  }

  async syncFolderReadmes(): Promise<void> {
    console.log("폴더 README 동기화 중...");

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
        console.log(`README 동기화: ${folderPath}`);
      } else {
        await this.folderRepo.ensureFolder(folderPath);
      }
    }

    console.log(`폴더 README ${synced}개 동기화 완료`);
  }
}
