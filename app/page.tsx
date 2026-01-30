import { getCategories, getRecentPosts } from "@/lib/data";
import { CategoryList } from "@/components/CategoryList";
import { PostCard } from "@/components/PostCard";
import { WebsiteJsonLd } from "@/components/JsonLd";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://fos-blog.vercel.app";

// Revalidate every hour
export const revalidate = 3600;

export default async function HomePage() {
  const [categories, recentPosts] = await Promise.all([
    getCategories(),
    getRecentPosts(6),
  ]);

  return (
    <>
      <WebsiteJsonLd
        url={siteUrl}
        name="FOS Study"
        description="개발 공부 기록을 정리하는 블로그입니다. AI, 알고리즘, 아키텍처, 데이터베이스, DevOps 등 다양한 주제를 다룹니다."
      />
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <section className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            <span>개발 학습 기록 블로그</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            FOS Study
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            AI, 알고리즘, 아키텍처, 데이터베이스, DevOps 등<br />
            다양한 개발 주제를 학습하고 정리합니다.
          </p>
        </section>

        {/* Categories Section */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
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

        {/* Recent Posts Section */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              최근 글
            </h2>
          </div>
          {recentPosts.length > 0 ? (
            <div className="space-y-4">
              {recentPosts.map((post) => (
                <PostCard key={post.path} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>아직 등록된 글이 없습니다.</p>
            </div>
          )}
        </section>

        {/* Stats Section */}
        <section className="mt-16 grid grid-cols-2 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-linear-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {categories.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              카테고리
            </div>
          </div>
          <div className="p-6 rounded-xl bg-linear-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 text-center">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              {categories.reduce((acc, cat) => acc + cat.count, 0)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              전체 글
            </div>
          </div>
          <div className="p-6 rounded-xl bg-linear-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 text-center col-span-2 md:col-span-1">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              ∞
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              계속 성장 중
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
