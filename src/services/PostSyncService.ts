import { PostRepository } from "@/infra/db/repositories/PostRepository";
import { extractDescription, extractTitle } from "@/lib/markdown";
import { rewriteImagePaths } from "@/infra/github/image-rewrite";
import type { getFileContent, getFileCommitDates } from "@/infra/github/api";

type GithubApi = {
  getFileContent: typeof getFileContent;
  getFileCommitDates: typeof getFileCommitDates;
};

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

export class PostSyncService {
  constructor(
    private postRepo: PostRepository,
    private githubApi: GithubApi,
  ) {}

  async upsert(filePath: string): Promise<"added" | "updated" | "skipped"> {
    const [fileData, commitDates] = await Promise.all([
      this.githubApi.getFileContent(filePath),
      this.githubApi.getFileCommitDates(filePath),
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

    const existingPostId = await this.postRepo.getPostId(filePath);

    if (existingPostId != null) {
      await this.postRepo.update(existingPostId, {
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
      await this.postRepo.create({
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
}
