import { eq } from "drizzle-orm";
import { posts } from "@/db/schema";
import { extractDescription, extractTitle } from "@/lib/markdown";
import { getDb } from "./client";
import { getFileContent, getFileCommitDates, getDirectoryContents, type ChangedFile } from "./api";
import { isMdFile } from "./file-filter";
import { rewriteImagePaths } from "./image-rewrite";
import { parsePath, upsertPost, deactivatePost } from "./post-sync";

export async function performIncrementalSync(changedFiles: ChangedFile[]): Promise<{
  added: number;
  updated: number;
  deleted: number;
}> {
  let added = 0, updated = 0, deleted = 0;

  for (const file of changedFiles) {
    if (file.status === "removed") {
      if (isMdFile(file.filename)) {
        const ok = await deactivatePost(file.filename);
        if (ok) deleted++;
        console.log(`삭제: ${file.filename}`);
      }
    } else if (file.status === "renamed") {
      // 이전 경로 비활성화
      if (file.previous_filename && isMdFile(file.previous_filename)) {
        const ok = await deactivatePost(file.previous_filename);
        if (ok) deleted++;
        console.log(`이름 변경(삭제): ${file.previous_filename}`);
      }
      // 새 경로 upsert
      if (isMdFile(file.filename)) {
        const result = await upsertPost(file.filename);
        if (result === "added") added++;
        else if (result === "updated") updated++;
        console.log(`이름 변경(추가): ${file.filename} → ${result}`);
      }
    } else {
      // added | modified | copied | changed
      if (isMdFile(file.filename)) {
        const result = await upsertPost(file.filename);
        if (result === "added") added++;
        else if (result === "updated") updated++;
        console.log(`${file.status}: ${file.filename} → ${result}`);
      }
    }
  }

  return { added, updated, deleted };
}

export async function collectMarkdownFiles(
  path: string = "",
  files: Array<{
    name: string;
    path: string;
    sha: string;
    category: string;
    subcategory?: string;
    folders: string[];
  }> = []
): Promise<typeof files> {
  const contents = await getDirectoryContents(path);
  for (const item of contents) {
    if (item.name.startsWith(".")) continue;
    if (item.type === "dir") {
      await collectMarkdownFiles(item.path, files);
    } else if (item.type === "file" && isMdFile(item.name)) {
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

export async function performFullSync(): Promise<{
  added: number;
  updated: number;
  deleted: number;
}> {
  const database = getDb();
  let added = 0, updated = 0, deleted = 0;

  const githubFiles = await collectMarkdownFiles();
  console.log(`GitHub에서 마크다운 파일 ${githubFiles.length}개 발견`);

  const existingPosts = await database.select().from(posts);
  const existingPathMap = new Map(existingPosts.map((p) => [p.path, p]));
  const processedPaths = new Set<string>();

  for (const file of githubFiles) {
    processedPaths.add(file.path);
    const existing = existingPathMap.get(file.path);

    if (existing && existing.sha === file.sha) continue;

    const [fileData, commitDates] = await Promise.all([
      getFileContent(file.path),
      getFileCommitDates(file.path),
    ]);
    if (!fileData) continue;

    const { title: filenameTitle } = parsePath(file.path);
    const content = rewriteImagePaths(fileData.content, file.path);
    const title = extractTitle(content) || filenameTitle;
    const description = extractDescription(content, 200);

    if (existing) {
      await database
        .update(posts)
        .set({
          title,
          content,
          description,
          sha: fileData.sha,
          category: file.category,
          subcategory: file.subcategory,
          folders: file.folders,
          isActive: true,
          updatedAt: commitDates?.updatedAt ?? new Date(),
        })
        .where(eq(posts.id, existing.id));
      updated++;
      console.log(`업데이트: ${file.path}`);
    } else {
      await database.insert(posts).values({
        title,
        path: file.path,
        slug: file.path,
        category: file.category,
        subcategory: file.subcategory,
        folders: file.folders,
        content,
        description,
        sha: fileData.sha,
        ...(commitDates && {
          createdAt: commitDates.createdAt,
          updatedAt: commitDates.updatedAt,
        }),
      });
      added++;
      console.log(`추가: ${file.path}`);
    }
  }

  for (const existing of existingPosts) {
    if (!processedPaths.has(existing.path) && existing.isActive) {
      await database
        .update(posts)
        .set({ isActive: false })
        .where(eq(posts.id, existing.id));
      deleted++;
      console.log(`비활성화: ${existing.path}`);
    }
  }

  return { added, updated, deleted };
}
