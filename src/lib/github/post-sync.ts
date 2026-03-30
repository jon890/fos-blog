import { eq } from "drizzle-orm";
import { posts } from "@/db/schema";
import { extractDescription, extractTitle } from "@/lib/markdown";
import { getDb } from "./client";
import { getFileContent, getFileCommitDates } from "./api";
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

export async function upsertPost(filePath: string): Promise<"added" | "updated" | "skipped"> {
  const database = getDb();
  const [fileData, commitDates] = await Promise.all([
    getFileContent(filePath),
    getFileCommitDates(filePath),
  ]);
  if (!fileData) return "skipped";

  const { category, foldersList, subcategory, title: filenameTitle } = parsePath(filePath);
  const content = rewriteImagePaths(fileData.content, filePath);
  const title = extractTitle(content) || filenameTitle;
  const description = extractDescription(content, 200);

  const existing = await database
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.path, filePath))
    .limit(1);

  if (existing.length > 0) {
    await database
      .update(posts)
      .set({
        title,
        content,
        description,
        sha: fileData.sha,
        category,
        subcategory,
        folders: foldersList,
        isActive: true,
        updatedAt: commitDates?.updatedAt ?? new Date(),
      })
      .where(eq(posts.id, existing[0].id));
    return "updated";
  } else {
    await database.insert(posts).values({
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

export async function deactivatePost(filePath: string): Promise<boolean> {
  const database = getDb();
  const result = await database
    .update(posts)
    .set({ isActive: false })
    .where(eq(posts.path, filePath));
  return (result[0] as { affectedRows?: number }).affectedRows === 1;
}
