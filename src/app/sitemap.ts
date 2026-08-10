import type { MetadataRoute } from "next";
import { getRepositories } from "@/infra/db/repositories";
import { env } from "@/env";
import logger from "@/lib/logger";
import { isCategoryIndexable } from "@/lib/category-index-policy";
import {
  computeFolderPaths,
  normalizeCategoryPathSegments,
} from "@/lib/path-utils";

const log = logger.child({ module: "app/sitemap" });

// ISR - 60초마다 재생성
export const revalidate = 60;

function normalizedCategoryPath(pathSegments: string[]): string {
  return normalizeCategoryPathSegments(pathSegments).join("/");
}

function countDirectPostsByFolder(postPaths: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const postPath of postPaths) {
    const pathSegments = postPath.split("/");
    const folderPath = normalizedCategoryPath(pathSegments.slice(0, -1));
    counts.set(folderPath, (counts.get(folderPath) ?? 0) + 1);
  }

  return counts;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL;

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/glossary`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  let categoryPages: MetadataRoute.Sitemap = [];
  let folderPages: MetadataRoute.Sitemap = [];
  let postPages: MetadataRoute.Sitemap = [];

  try {
    const { category, folder, post } = getRepositories();

    const [categories, readmeLengths, postsData] = await Promise.all([
      category.getCategories(),
      folder.getReadmeLengths(),
      post.getAllPostsForSitemap(),
    ]);

    const folderPaths = computeFolderPaths(postsData.map(({ path }) => path));
    const directPostCounts = countDirectPostsByFolder(
      postsData.map(({ path }) => path),
    );
    const shouldIncludeCategory = (pathSegments: string[]) => {
      const folderPath = normalizedCategoryPath(pathSegments);
      return isCategoryIndexable({
        readmeLength: readmeLengths.get(folderPath) ?? 0,
        directPostCount: directPostCounts.get(folderPath) ?? 0,
      });
    };

    categoryPages = categories
      .filter((cat) => shouldIncludeCategory([cat.slug]))
      .map((cat) => ({
        url: `${baseUrl}/category/${normalizeCategoryPathSegments([cat.slug])
          .map(encodeURIComponent)
          .join("/")}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));

    folderPages = folderPaths
      .filter(shouldIncludeCategory)
      .map((pathSegments) => ({
        url: `${baseUrl}/category/${normalizeCategoryPathSegments(pathSegments)
          .map(encodeURIComponent)
          .join("/")}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));

    postPages = postsData.map(({ path, updatedAt }) => ({
      url: `${baseUrl}/posts/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      lastModified: updatedAt ?? new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));
  } catch (error) {
    log.warn({ err: error instanceof Error ? error : new Error(String(error)) }, "Failed to fetch dynamic sitemap data");
  }

  const pages = [...staticPages, ...categoryPages, ...folderPages, ...postPages];
  const pagesByUrl = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const page of pages) {
    if (!pagesByUrl.has(page.url)) {
      pagesByUrl.set(page.url, page);
    }
  }

  return Array.from(pagesByUrl.values());
}
