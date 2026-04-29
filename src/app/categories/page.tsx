import { getRepositories } from "@/infra/db/repositories";
import type { CategoryData } from "@/infra/db/types";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CategoriesSubHero } from "@/components/CategoriesSubHero";
import { CategoryFeatured } from "@/components/CategoryFeatured";
import { CategoryCard } from "@/components/CategoryCard";
import { CategoriesSection } from "@/components/CategoriesSection";
import { formatYYYYMMDD } from "@/lib/time";
import { Metadata } from "next";
import { env } from "@/env";
import logger from "@/lib/logger";

const log = logger.child({ module: "app/categories" });

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
  let categories: Array<CategoryData & { latestUpdatedAt: Date | null }> = [];

  try {
    const { category } = getRepositories();
    categories = await category.getCategoriesWithLatest();
  } catch (error) {
    log.warn(
      { err: error instanceof Error ? error : new Error(String(error)) },
      "Database not available",
    );
  }

  const top3 = categories.slice(0, 3);
  const rest = categories.slice(3);
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  const maxLatestUpdatedAt =
    categories.reduce<Date | null>((max, c) => {
      if (!c.latestUpdatedAt) return max;
      const d = c.latestUpdatedAt instanceof Date ? c.latestUpdatedAt : new Date(c.latestUpdatedAt as unknown as string);
      if (!max) return d;
      return d > max ? d : max;
    }, null);

  return (
    <>
      <Breadcrumb items={[{ label: "fos-blog", href: "/" }, { label: "categories" }]} />
      <CategoriesSubHero
        eyebrow="INDEX · CATEGORIES"
        title="카테고리"
        sublines={[
          { num: categories.length, suffix: "개 주제" },
          { num: totalCount, suffix: "개의 글" },
          `updated ${formatYYYYMMDD(maxLatestUpdatedAt)}`,
        ]}
      />
      <main className="mx-auto max-w-[1180px] px-8 py-12 pb-20 space-y-14">
        {top3.length > 0 && (
          <CategoriesSection idx="01" title="Most active" meta="top 3 · 카테고리 전체 기준">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {top3.map((c, i) => (
                <CategoryFeatured
                  key={c.slug}
                  category={c}
                  rank={i + 1}
                  latestUpdatedAt={c.latestUpdatedAt}
                />
              ))}
            </div>
          </CategoriesSection>
        )}
        {rest.length > 0 && (
          <CategoriesSection
            idx="02"
            title="All categories"
            meta={`${rest.length} canonical · alphabetical`}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {rest.map((c) => (
                <CategoryCard key={c.slug} category={c} />
              ))}
            </div>
          </CategoriesSection>
        )}
      </main>
    </>
  );
}
