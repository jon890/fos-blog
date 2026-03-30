import { getDb } from "@/db";
import { CategoryRepository } from "@/db/repositories/CategoryRepository";
import { FolderRepository } from "@/db/repositories/FolderRepository";
import { PostRepository } from "@/db/repositories/PostRepository";
import { getFileContent } from "./api";

export async function updateCategories(): Promise<void> {
  const db = getDb();
  const categoryRepo = new CategoryRepository(db);
  await categoryRepo.rebuild();
}

export async function syncFolderReadmes(): Promise<void> {
  const db = getDb();
  const postRepo = new PostRepository(db);
  const folderRepo = new FolderRepository(db);

  console.log("폴더 README 동기화 중...");

  const postPaths = await postRepo.getAllPostPaths();

  const folderPaths = new Set<string>();
  for (const path of postPaths) {
    const parts = path.split("/");
    for (let i = 1; i <= parts.length - 1; i++) {
      const folderPath = parts.slice(0, i).join("/");
      if (folderPath) folderPaths.add(folderPath);
    }
  }

  const existingFolderMap = await folderRepo.getAll();
  const readmeNames = ["README.md", "readme.md", "README.MD", "Readme.md"];
  let synced = 0;

  for (const folderPath of folderPaths) {
    let readmeContent: { content: string; sha: string } | null = null;
    for (const readmeName of readmeNames) {
      const result = await getFileContent(`${folderPath}/${readmeName}`);
      if (result) {
        readmeContent = result;
        break;
      }
    }

    const existing = existingFolderMap.get(folderPath);

    if (readmeContent) {
      if (existing && existing.sha === readmeContent.sha) continue;
      await folderRepo.upsert(folderPath, readmeContent.content, readmeContent.sha);
      synced++;
      console.log(`README 동기화: ${folderPath}`);
    } else {
      await folderRepo.ensureFolder(folderPath);
    }
  }

  console.log(`폴더 README ${synced}개 동기화 완료`);
}
