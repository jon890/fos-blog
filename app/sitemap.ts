import type { MetadataRoute } from "next";
import {
  getCategories,
  getAllPostPaths,
  getAllFolderPaths,
} from "@/lib/db-queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  }

  // 정적 페이지
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

  // 카테고리 페이지
  const categories = await getCategories();
  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${baseUrl}/category/${encodeURIComponent(category.slug)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // 폴더 페이지 (n-depth)
  const folderPaths = await getAllFolderPaths();
  const folderPages: MetadataRoute.Sitemap = folderPaths.map(
    (pathSegments) => ({
      url: `${baseUrl}/category/${pathSegments
        .map(encodeURIComponent)
        .join("/")}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })
  );

  // 포스트 페이지
  const postPaths = await getAllPostPaths();
  const postPages: MetadataRoute.Sitemap = postPaths.map((path) => ({
    url: `${baseUrl}/posts/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...categoryPages, ...folderPages, ...postPages];
}
