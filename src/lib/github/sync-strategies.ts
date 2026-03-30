import { PostRepository } from "@/db/repositories";
import { extractDescription, extractTitle } from "@/lib/markdown";
import {
  getDirectoryContents,
  getFileCommitDates,
  getFileContent,
  type ChangedFile,
} from "./api";
import { getDb } from "@/db";
import { shouldSyncFile } from "./file-filter";
import { rewriteImagePaths } from "./image-rewrite";
import { parsePath, upsertPost } from "./post-sync";

export async function performIncrementalSync(
  changedFiles: ChangedFile[],
): Promise<{
  added: number;
  updated: number;
  deleted: number;
}> {
  let added = 0,
    updated = 0,
    deleted = 0;

  const postRepository = new PostRepository(getDb());

  for (const file of changedFiles) {
    if (file.status === "removed") {
      if (shouldSyncFile(file.filename)) {
        const ok = await postRepository.deactive(file.filename);
        if (ok) deleted++;
        console.log(`삭제: ${file.filename}`);
      }
    } else if (file.status === "renamed") {
      if (file.previous_filename && shouldSyncFile(file.previous_filename)) {
        const ok = await postRepository.deactive(file.filename);
        if (ok) deleted++;
        console.log(`이름 변경(삭제): ${file.previous_filename}`);
      }
      if (shouldSyncFile(file.filename)) {
        const result = await upsertPost(file.filename);
        if (result === "added") added++;
        else if (result === "updated") updated++;
        console.log(`이름 변경(추가): ${file.filename} → ${result}`);
      }
    } else {
      if (shouldSyncFile(file.filename)) {
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
  }> = [],
): Promise<typeof files> {
  const contents = await getDirectoryContents(path);
  for (const item of contents) {
    if (item.name.startsWith(".")) continue;
    if (item.type === "dir") {
      await collectMarkdownFiles(item.path, files);
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

export async function performFullSync(): Promise<{
  added: number;
  updated: number;
  deleted: number;
}> {
  const postRepository = new PostRepository(getDb());
  let added = 0,
    updated = 0,
    deleted = 0;

  const githubFiles = await collectMarkdownFiles();
  console.log(`GitHub에서 마크다운 파일 ${githubFiles.length}개 발견`);

  const existingPosts = await postRepository.getAllForSync();
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
      await postRepository.update(existing.id, {
        title,
        content,
        description,
        sha: fileData.sha,
        category: file.category,
        subcategory: file.subcategory,
        folders: file.folders,
        isActive: true,
        updatedAt: commitDates?.updatedAt ?? new Date(),
      });
      updated++;
      console.log(`업데이트: ${file.path}`);
    } else {
      await postRepository.create({
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

  deleted = await postRepository.deactivateMissing(processedPaths);

  return { added, updated, deleted };
}
