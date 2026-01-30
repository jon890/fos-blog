import type { MetadataRoute } from "next";
import {
  getCategories,
  getAllPostPaths,
  getAllFolderPaths,
} from "@/lib/db-queries";

// ISR - 60초마다 재생성
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://fos-blog.vercel.app";

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

  // DB에서 동적 데이터 조회 (실패 시 빈 배열)
  let categoryPages: MetadataRoute.Sitemap = [];
  let folderPages: MetadataRoute.Sitemap = [];
  let postPages: MetadataRoute.Sitemap = [];

  try {
    // 카테고리 페이지
    const categories = await getCategories();
    categoryPages = categories.map((category) => ({
      url: `${baseUrl}/category/${encodeURIComponent(category.slug)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    // 폴더 페이지 (n-depth)
    const folderPaths = await getAllFolderPaths();
    folderPages = folderPaths.map((pathSegments) => ({
      url: `${baseUrl}/category/${pathSegments
        .map(encodeURIComponent)
        .join("/")}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    // 포스트 페이지
    const postPaths = await getAllPostPaths();
    postPages = postPaths.map((path) => ({
      url: `${baseUrl}/posts/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));
  } catch (error) {
    console.warn("Failed to fetch dynamic sitemap data:", error);
  }

  return [...staticPages, ...categoryPages, ...folderPages, ...postPages];
}
