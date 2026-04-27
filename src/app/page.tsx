import { getRepositories } from "@/infra/db/repositories";
import type { CategoryData, PostData } from "@/infra/db/types";
import { env } from "@/env";
import logger from "@/lib/logger";

const log = logger.child({ module: "app/page" });
import { CategoryList } from "@/components/CategoryList";
import { PostCard } from "@/components/PostCard";
import { SectionCTAButton } from "@/components/SectionCTAButton";
import { WebsiteJsonLd } from "@/components/JsonLd";
import { HomeHero } from "@/components/HomeHero";
import { ArrowRight, Flame } from "lucide-react";
import Link from "next/link";

const siteUrl = env.NEXT_PUBLIC_SITE_URL;

// ISR - 60초마다 페이지 재생성
export const revalidate = 60;

async function getPopularPosts(
  limit: number
): Promise<Array<PostData & { visitCount: number }>> {
  const { visit, post } = getRepositories();
  const popularPaths = await visit.getPopularPostPaths(limit * 3);
  if (popularPaths.length === 0) return [];
  const paths = popularPaths.map((p) => p.path);
  const postDataList = await post.getPostsByPaths(paths);
  const visitMap = new Map(popularPaths.map((p) => [p.path, p.visitCount]));
  return postDataList
    .map((p) => ({ ...p, visitCount: visitMap.get(p.path) ?? 0 }))
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, limit);
}

export default async function HomePage() {
  let categories: CategoryData[] = [];
  let recentPosts: PostData[] = [];
  let popularPosts: Array<PostData & { visitCount: number }> = [];
  let visitCounts: Record<string, number> = {};
  let postCountTotal = 0;

  try {
    const { category, post, visit } = getRepositories();
    [categories, recentPosts, popularPosts, postCountTotal] = await Promise.all([
      category.getCategories(),
      post.getRecentPosts(6),
      getPopularPosts(6),
      post.getActivePostCount(),
    ]);

    const postPaths = recentPosts.map((p) => p.path);
    if (postPaths.length > 0) {
      visitCounts = await visit.getPostVisitCounts(postPaths);
    }
  } catch (error) {
    log.warn({ err: error instanceof Error ? error : new Error(String(error)) }, "Database not available");
  }

  const categoryCount = categories.length;
  const seriesCount: number | null = null;
  const subscriberCount: number | null = null;

  return (
    <>
      <WebsiteJsonLd
        url={siteUrl}
        name="FOS Study"
        description="개발 공부 기록을 정리하는 블로그입니다. AI, 알고리즘, 아키텍처, 데이터베이스, DevOps 등 다양한 주제를 다룹니다."
      />
      <HomeHero
        postCount={postCountTotal}
        categoryCount={categoryCount}
        seriesCount={seriesCount}
        subscriberCount={subscriberCount}
      />
      <main className="container mx-auto px-4 py-12 md:py-16">
        {/* Categories Section */}
        <section className="mb-8 md:mb-16">
          <div className="flex items-center justify-between mb-4 md:mb-8">
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white">
              카테고리
            </h2>
            <Link
              href="/categories"
              className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
            >
              모두 보기
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <CategoryList categories={categories.slice(0, 6)} />
        </section>

        {/* Popular Posts Section */}
        {popularPosts.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-2 mb-8">
              <Flame className="w-6 h-6 text-orange-500" />
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                인기 글
              </h2>
            </div>
            <div className="space-y-4">
              {popularPosts.map((post) => (
                <PostCard
                  key={post.path}
                  post={post}
                  viewCount={post.visitCount}
                />
              ))}
            </div>
            <SectionCTAButton href="/posts/popular" label="인기 글 더 보기" />
          </section>
        )}

        {/* Recent Posts Section */}
        <section>
          <div className="flex items-center justify-between mb-4 md:mb-8">
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white">
              최근 글
            </h2>
          </div>
          {recentPosts.length > 0 ? (
            <>
              <div className="space-y-2 md:space-y-4">
                {recentPosts.map((post) => (
                  <PostCard
                    key={post.path}
                    post={post}
                    viewCount={visitCounts[post.path] ?? 0}
                  />
                ))}
              </div>
              <SectionCTAButton href="/posts/latest" label="최신 글 더 보기" />
            </>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>아직 등록된 글이 없습니다.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
