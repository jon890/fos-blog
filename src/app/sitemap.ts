import type { MetadataRoute } from "next";
import { getRepositories } from "@/infra/db/repositories";

// ISR - 60초마다 재생성
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://fosworld.co.kr";

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
    const { category, folder, post } = getRepositories();

    const [categories, folderPaths, postsData] = await Promise.all([
      category.getCategories(),
      folder.getAllFolderPaths(),
      post.getAllPostsForSitemap(),
    ]);

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
