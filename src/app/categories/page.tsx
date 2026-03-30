import { getDbQueries } from "@/db/queries";
import { CategoryList } from "@/components/CategoryList";
import { Metadata } from "next";
import { env } from "@/env";

// ISR - 60초마다 페이지 재생성
export const revalidate = 60;

const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: "카테고리",
  description: "모든 카테고리 목록을 확인하세요.",
  alternates: {
    canonical: `${siteUrl}/categories`,
  },
  openGraph: {
    title: "카테고리 | FOS Study",
    description: "모든 카테고리 목록을 확인하세요.",
    url: `${siteUrl}/categories`,
    type: "website",
  },
};

export default async function CategoriesPage() {
  const dbQueries = getDbQueries();
  const categories = dbQueries ? await dbQueries.getCategories() : [];

  return (
    <div className="container mx-auto px-4 py-6 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          카테고리
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {categories.length}개의 카테고리에서 다양한 주제의 글을 확인하세요.
        </p>
      </div>

      <CategoryList categories={categories} />
    </div>
  );
}
