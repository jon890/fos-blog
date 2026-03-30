import { PostRepository } from "@/db/repositories";
import { extractDescription, extractTitle } from "@/lib/markdown";
import { getFileCommitDates, getFileContent } from "./api";
import { getDb } from "@/db";
import { rewriteImagePaths } from "./image-rewrite";

export function parsePath(filePath: string) {
  const pathParts = filePath.split("/");
  const category = pathParts[0] || "uncategorized";
  const foldersList = pathParts.slice(1, -1);
  const subcategory = foldersList.length > 0 ? foldersList[0] : undefined;
  const title = pathParts[pathParts.length - 1]
    .replace(/\.(md|mdx)$/, "")
    .replace(/_/g, " ");
  return { category, foldersList, subcategory, title };
}

export async function upsertPost(
  filePath: string,
): Promise<"added" | "updated" | "skipped"> {
  const postRepository = new PostRepository(getDb());

  const [fileData, commitDates] = await Promise.all([
    getFileContent(filePath),
    getFileCommitDates(filePath),
  ]);
  if (!fileData) return "skipped";

  const {
    category,
    foldersList,
    subcategory,
    title: filenameTitle,
  } = parsePath(filePath);
  const content = rewriteImagePaths(fileData.content, filePath);
  const title = extractTitle(content) || filenameTitle;
  const description = extractDescription(content, 200);

  const existingPostId = await postRepository.getPostId(filePath);

  if (existingPostId != null) {
    await postRepository.update(existingPostId, {
      title,
      content,
      description,
      sha: fileData.sha,
      category,
      subcategory,
      folders: foldersList,
      isActive: true,
      updatedAt: commitDates?.updatedAt ?? new Date(),
    });
    return "updated";
  } else {
    await postRepository.create({
      title,
      path: filePath,
      slug: filePath,
      category,
      subcategory,
      folders: foldersList,
      content,
      description,
      sha: fileData.sha,
      ...(commitDates && {
        createdAt: commitDates.createdAt,
        updatedAt: commitDates.updatedAt,
      }),
    });

    return "added";
  }
}
