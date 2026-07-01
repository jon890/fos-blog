import { PostRepository } from "@/infra/db/repositories/PostRepository";
import { extractDescription, extractTitle, parseFrontMatter } from "@/lib/markdown";
import type { FrontMatter } from "@/lib/markdown";
import { rewriteImagePaths } from "@/infra/github/image-rewrite";
import type { getFileContent, getFileCommitDates } from "@/infra/github/api";
import logger from "@/lib/logger";
import { isKnownCategoryKey } from "@/lib/category-meta";

const log = logger.child({ module: "PostSyncService" });

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
  fmCategories?: string[],
): void {
  const unknownCategories = (fmCategories ?? [])
    .map((category) => category.trim())
    .filter((category) => category.length > 0)
    .filter((category) => category !== pathCategory)
    .filter((category) => !isKnownCategoryKey(category));

  if (unknownCategories.length === 0) return;

  log.warn(
    { path, categories: unknownCategories },
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
    const { frontMatter } = parseFrontMatter(content);
    const { tags, series, seriesOrder } = resolveFrontMatterMeta(frontMatter, filePath);
    warnUnknownFrontMatterCategories(filePath, category, frontMatter.categories);
    const categories = mergeCategories(category, frontMatter.categories);

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
}
