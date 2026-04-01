import { getRepositories } from "@/infra/db/repositories";
import type { CategoryData, PostData } from "@/infra/db/types";
import { CategoryList } from "@/components/CategoryList";
import { PostCard } from "@/components/PostCard";
import { WebsiteJsonLd } from "@/components/JsonLd";
import { ArrowRight, Sparkles, Flame } from "lucide-react";
import Link from "next/link";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://fos-blog.vercel.app";

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

  try {
    const { category, post, visit } = getRepositories();
    [categories, recentPosts, popularPosts] = await Promise.all([
      category.getCategories(),
      post.getRecentPosts(6),
      getPopularPosts(6),
    ]);

    const postPaths = recentPosts.map((p) => p.path);
    if (postPaths.length > 0) {
      visitCounts = await visit.getPostVisitCounts(postPaths);
    }
  } catch (error) {
    console.warn("Database not available:", error);
  }

  return (
    <>
      <WebsiteJsonLd
        url={siteUrl}
        name="FOS Study"
        description="개발 공부 기록을 정리하는 블로그입니다. AI, 알고리즘, 아키텍처, 데이터베이스, DevOps 등 다양한 주제를 다룹니다."
      />
      <div className="container mx-auto px-4 py-6 md:py-12">
        {/* Hero Section */}
        <section className="relative text-center mb-8 md:mb-16 animate-fade-in py-4 md:py-8 overflow-hidden">
          {/* Decorative background blobs */}
          <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-blue-500/5 dark:bg-blue-400/10 blur-3xl" />
            <div className="absolute -top-4 right-1/3 w-48 h-48 rounded-full bg-purple-500/5 dark:bg-purple-400/8 blur-2xl" />
            <div className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full bg-cyan-500/5 dark:bg-cyan-400/8 blur-xl" />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-6 border border-blue-200 dark:border-blue-800/50">
            <Sparkles className="w-4 h-4" />
            <span>개발 학습 기록 블로그</span>
          </div>
          <h1 className="text-3xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
            FOS Study
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            AI, 알고리즘, 아키텍처, 데이터베이스, DevOps 등<br />
            다양한 개발 주제를 학습하고 정리합니다.
          </p>
        </section>

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
            <div className="space-y-2 md:space-y-4">
              {recentPosts.map((post) => (
                <PostCard
                  key={post.path}
                  post={post}
                  viewCount={visitCounts[post.path] ?? 0}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>아직 등록된 글이 없습니다.</p>
            </div>
          )}
        </section>

        {/* Stats Section */}
        <section className="mt-8 md:mt-16 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
          <div className="p-4 md:p-6 rounded-xl bg-linear-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 text-center">
            <div className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1 md:mb-2">
              {categories.length}
            </div>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              카테고리
            </div>
          </div>
          <div className="p-4 md:p-6 rounded-xl bg-linear-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 text-center">
            <div className="text-2xl md:text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1 md:mb-2">
              {categories.reduce((acc, cat) => acc + cat.count, 0)}
            </div>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              전체 글
            </div>
          </div>
          <div className="p-4 md:p-6 rounded-xl bg-linear-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 text-center col-span-2 md:col-span-1">
            <div className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400 mb-1 md:mb-2">
              ∞
            </div>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              계속 성장 중
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
