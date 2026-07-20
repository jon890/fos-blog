import { PostRepository } from "@/infra/db/repositories/PostRepository";
import { extractDescription, extractTitle, parseFrontMatter } from "@/lib/markdown";
import type { FrontMatter } from "@/lib/markdown";
import { rewriteImagePaths } from "@/infra/github/image-rewrite";
import type { ChangedFile } from "@/infra/github/api";
import logger from "@/lib/logger";
import { isKnownCategoryKey } from "@/lib/category-meta";
import { shouldSyncFile } from "@/infra/github/file-filter";

const log = logger.child({ module: "PostSyncService" });

type GithubApi = {
  getRepositoryFolderPaths: (
    commitSha: string,
  ) => Promise<ReadonlySet<string> | null>;
  getDirectoryContents: (path?: string) => Promise<
    Array<{ name: string; path: string; sha: string; type: string }>
  >;
  getFileContent: (
    path: string,
  ) => Promise<{ content: string; sha: string } | null>;
  getFileCommitDates: (
    path: string,
  ) => Promise<{ createdAt: Date; updatedAt: Date } | null>;
};

type PostRepo = Pick<
  PostRepository,
  | "create"
  | "deactive"
  | "deactivateByIds"
  | "getAllForSync"
  | "getAllWithContent"
  | "getPostId"
  | "update"
>;

export type SyncedPageChange = {
  path: string;
  operation: "upsert" | "delete";
};

export type PostSyncResult = {
  added: number;
  updated: number;
  deleted: number;
  changedPosts: SyncedPageChange[];
  titles: { total: number; updated: number; skipped: number };
};

type MarkdownFile = {
  path: string;
  sha: string;
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

export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  return Array.from(new Set(cleaned));
}

export function mergeCategories(pathCategory: string, fmCategories?: string[]): string[] {
  const all = [pathCategory, ...(fmCategories ?? [])]
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  return Array.from(new Set(all));
}

export function warnUnknownFrontMatterCategories(
  path: string,
  pathCategory: string,
  fmCategories: string[] | undefined,
  repositoryFolderPaths: ReadonlySet<string> | null,
): void {
  if (repositoryFolderPaths == null) return;

  const unknownCategories = (fmCategories ?? [])
    .map((category) => category.trim())
    .filter((category) => category.length > 0)
    .filter((category) => category !== pathCategory)
    .filter((category) => !repositoryFolderPaths.has(category))
    .filter((category) => !isKnownCategoryKey(category));

  const uniqueUnknownCategories = Array.from(new Set(unknownCategories));

  if (uniqueUnknownCategories.length === 0) return;

  log.warn(
    { path, categories: uniqueUnknownCategories },
    "frontmatter categories 에 알려지지 않은 category key 포함",
  );
}

export function resolveFrontMatterMeta(
  frontMatter: FrontMatter,
  path: string,
): {
  tags: string[];
  series: string | null;
  seriesOrder: number | null;
} {
  const tags = normalizeTags(frontMatter.tags);
  const rawSeries =
    typeof frontMatter.series === "string" ? frontMatter.series.trim() : "";
  const rawOrder = frontMatter.seriesOrder;

  let series: string | null = null;
  let seriesOrder: number | null = null;

  if (rawSeries) {
    const parsedOrder =
      typeof rawOrder === "number"
        ? rawOrder
        : typeof rawOrder === "string" && rawOrder.trim() !== ""
          ? Number(rawOrder)
          : NaN;

    if (Number.isFinite(parsedOrder) && parsedOrder >= 0) {
      series = rawSeries;
      seriesOrder = Math.trunc(parsedOrder);
    } else {
      log.warn(
        { path, series: rawSeries, rawOrder },
        "frontmatter 'series' 있으나 'seriesOrder' 누락/유효하지 않음 — series 메타 무시",
      );
    }
  }

  return { tags, series, seriesOrder };
}

export class PostSyncService {
  constructor(
    private postRepo: PostRepo,
    private githubApi: GithubApi,
  ) {}

  async syncAll(headSha: string): Promise<PostSyncResult> {
    let added = 0;
    let updated = 0;

    const repositoryFolderPaths =
      await this.githubApi.getRepositoryFolderPaths(headSha);
    const githubFiles = await this.collectMarkdownFiles();
    log.info(
      { count: githubFiles.length },
      `GitHub에서 마크다운 파일 ${githubFiles.length}개 발견`,
    );

    const existingPosts = await this.postRepo.getAllForSync();
    const existingPathMap = new Map(existingPosts.map((post) => [post.path, post]));
    const processedPaths = new Set<string>();
    const changedPosts: SyncedPageChange[] = [];

    for (const file of githubFiles) {
      processedPaths.add(file.path);
      const existing = existingPathMap.get(file.path);
      if (existing?.sha === file.sha) continue;

      const result = await this.upsert(
        file.path,
        repositoryFolderPaths,
        existing?.id,
      );
      if (result === "added") added++;
      if (result === "updated") updated++;
      if (result !== "skipped") {
        changedPosts.push({ path: file.path, operation: "upsert" });
        log.info({ path: file.path, result }, `${result}: ${file.path}`);
      }
    }

    const postsToDeactivate = existingPosts.filter(
      (post) => post.isActive && !processedPaths.has(post.path),
    );
    const deleted = await this.postRepo.deactivateByIds(
      postsToDeactivate.map((post) => post.id),
    );
    if (deleted > 0) {
      changedPosts.push(
        ...postsToDeactivate.map((post) => ({
          path: post.path,
          operation: "delete" as const,
        })),
      );
      log.info({ deleted }, `비활성화 완료: ${deleted}개`);
    }

    return {
      added,
      updated,
      deleted,
      changedPosts,
      titles: await this.retitleAll(),
    };
  }

  async syncChanged(
    changedFiles: ChangedFile[],
    headSha: string,
  ): Promise<PostSyncResult> {
    let added = 0;
    let updated = 0;
    let deleted = 0;
    const changedPosts: SyncedPageChange[] = [];
    const repositoryFolderPaths =
      await this.githubApi.getRepositoryFolderPaths(headSha);

    for (const file of changedFiles) {
      if (file.status === "removed") {
        if (await this.postRepo.deactive(file.filename)) {
          deleted++;
          changedPosts.push({ path: file.filename, operation: "delete" });
        }
        log.info({ filename: file.filename }, `삭제: ${file.filename}`);
        continue;
      }

      if (file.status === "renamed" && file.previous_filename) {
        if (await this.postRepo.deactive(file.previous_filename)) {
          deleted++;
          changedPosts.push({
            path: file.previous_filename,
            operation: "delete",
          });
        }
        log.info(
          { filename: file.previous_filename },
          `이름 변경(삭제): ${file.previous_filename}`,
        );
      }

      if (!shouldSyncFile(file.filename)) continue;

      const result = await this.upsert(file.filename, repositoryFolderPaths);
      if (result === "added") added++;
      if (result === "updated") updated++;
      if (result !== "skipped") {
        changedPosts.push({ path: file.filename, operation: "upsert" });
      }
      log.info(
        { status: file.status, filename: file.filename, result },
        `${file.status}: ${file.filename} → ${result}`,
      );
    }

    return {
      added,
      updated,
      deleted,
      changedPosts,
      titles: await this.retitleAll(),
    };
  }

  async retitleAll(): Promise<{ total: number; updated: number; skipped: number }> {
    const allPosts = await this.postRepo.getAllWithContent();
    let updated = 0;
    let skipped = 0;

    for (const post of allPosts) {
      if (!post.content) {
        skipped++;
        continue;
      }
      const extractedTitle = extractTitle(post.content);
      if (!extractedTitle || extractedTitle === post.title) {
        skipped++;
        continue;
      }
      await this.postRepo.update(post.id, { title: extractedTitle });
      updated++;
    }

    return { total: allPosts.length, updated, skipped };
  }

  private async upsert(
    filePath: string,
    repositoryFolderPaths: ReadonlySet<string> | null,
    knownPostId?: number,
  ): Promise<"added" | "updated" | "skipped"> {
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
    const { frontMatter } = parseFrontMatter(content);
    const { tags, series, seriesOrder } = resolveFrontMatterMeta(frontMatter, filePath);
    warnUnknownFrontMatterCategories(
      filePath,
      category,
      frontMatter.categories,
      repositoryFolderPaths,
    );
    const categories = mergeCategories(category, frontMatter.categories);

    const existingPostId = knownPostId ?? await this.postRepo.getPostId(filePath);

    if (existingPostId != null) {
      await this.postRepo.update(existingPostId, {
        title,
        content,
        description,
        sha: fileData.sha,
        category,
        subcategory,
        folders: foldersList,
        tags,
        series,
        seriesOrder,
        categories,
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
        tags,
        series,
        seriesOrder,
        categories,
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

  private async collectMarkdownFiles(
    path: string = "",
    files: MarkdownFile[] = [],
  ): Promise<MarkdownFile[]> {
    const contents = await this.githubApi.getDirectoryContents(path);
    for (const item of contents) {
      if (item.name.startsWith(".")) continue;
      if (item.type === "dir") {
        await this.collectMarkdownFiles(item.path, files);
      } else if (item.type === "file" && shouldSyncFile(item.name)) {
        files.push({ path: item.path, sha: item.sha });
      }
    }
    return files;
  }
}
