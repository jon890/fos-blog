import {
  getPostsByCategory,
  getCategories,
  getCategoryIcon,
} from "@/lib/data";
import { PostCard } from "@/components/PostCard";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Metadata } from "next";

export const revalidate = 3600;

interface CategoryPageProps {
  params: Promise<{
    category: string;
  }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const category = decodeURIComponent(resolvedParams.category);

  return {
    title: `${category} - FOS Study`,
    description: `${category} 카테고리의 모든 글을 확인하세요.`,
  };
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({
    category: category.slug,
  }));
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const resolvedParams = await params;
  const category = decodeURIComponent(resolvedParams.category);
  const posts = await getPostsByCategory(category);

  if (posts.length === 0) {
    notFound();
  }

  const icon = getCategoryIcon(category);

  // Group posts by subcategory
  const groupedPosts = posts.reduce(
    (acc, post) => {
      const key = post.subcategory || "기타";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(post);
      return acc;
    },
    {} as Record<string, typeof posts>
  );

  const subcategories = Object.keys(groupedPosts).sort();

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Back button */}
      <Link
        href="/categories"
        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>카테고리 목록으로</span>
      </Link>

      {/* Header */}
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-5xl">{icon}</span>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              {category}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {posts.length}개의 글
            </p>
          </div>
        </div>
      </header>

      {/* Posts grouped by subcategory */}
      <div className="space-y-12">
        {subcategories.length === 1 && subcategories[0] === "기타" ? (
          // No subcategories, show flat list
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.path} post={post} showCategory={false} />
            ))}
          </div>
        ) : (
          // Show grouped by subcategory
          subcategories.map((subcategory) => (
            <section key={subcategory}>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white mb-4">
                <FileText className="w-5 h-5 text-gray-400" />
                {subcategory}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({groupedPosts[subcategory].length})
                </span>
              </h2>
              <div className="space-y-3">
                {groupedPosts[subcategory].map((post) => (
                  <PostCard key={post.path} post={post} showCategory={false} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
