import type { MetadataRoute } from "next";
import { getRepositories } from "@/infra/db/repositories";
import { env } from "@/env";
import { computeFolderPaths } from "@/lib/path-utils";

// ISR - 60초마다 재생성
export const revalidate = 60;

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
  ];

  let categoryPages: MetadataRoute.Sitemap = [];
  let folderPages: MetadataRoute.Sitemap = [];
  let postPages: MetadataRoute.Sitemap = [];

  try {
    const { category, post } = getRepositories();

    const [categories, postsData] = await Promise.all([
      category.getCategories(),
      post.getAllPostsForSitemap(),
    ]);

    const folderPaths = computeFolderPaths(postsData.map(({ path }) => path));

    categoryPages = categories.map((cat) => ({
      url: `${baseUrl}/category/${encodeURIComponent(cat.slug)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    folderPages = folderPaths.map((pathSegments) => ({
      url: `${baseUrl}/category/${pathSegments
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
    console.warn("Failed to fetch dynamic sitemap data:", error);
  }

  return [...staticPages, ...categoryPages, ...folderPages, ...postPages];
}
