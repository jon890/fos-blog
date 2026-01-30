import {
  getFolderContents,
  getAllFolderPaths,
  getCategoryIcon,
} from "@/lib/db-queries";
import { PostCard } from "@/components/PostCard";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Folder, ChevronRight, Home, BookOpen } from "lucide-react";
import { Metadata } from "next";

// 동적 렌더링 - 매 요청마다 DB 조회
export const dynamic = "force-dynamic";

interface FolderPageProps {
  params: Promise<{
    path: string[];
  }>;
}

export async function generateMetadata({
  params,
}: FolderPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path.map(decodeURIComponent);
  const currentFolder = pathSegments[pathSegments.length - 1];

  return {
    title: `${currentFolder} - FOS Study`,
    description: `${pathSegments.join(" > ")} 폴더의 모든 글을 확인하세요.`,
  };
}

export async function generateStaticParams() {
  const paths = await getAllFolderPaths();
  return paths.map((pathSegments) => ({
    path: pathSegments,
  }));
}

export default async function FolderPage({ params }: FolderPageProps) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path.map(decodeURIComponent);
  const folderPath = pathSegments.join("/");
  const category = pathSegments[0];
  const currentFolder = pathSegments[pathSegments.length - 1];

  const { folders, posts, readme } = await getFolderContents(folderPath);

  if (folders.length === 0 && posts.length === 0 && !readme) {
    notFound();
  }

  const icon = getCategoryIcon(category);

  // Build breadcrumb items
  const breadcrumbs = pathSegments.map((segment, index) => ({
    name: segment,
    path: `/category/${pathSegments
      .slice(0, index + 1)
      .map(encodeURIComponent)
      .join("/")}`,
    isLast: index === pathSegments.length - 1,
  }));

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Back button */}
      {pathSegments.length > 1 ? (
        <Link
          href={`/category/${pathSegments
            .slice(0, -1)
            .map(encodeURIComponent)
            .join("/")}`}
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>상위 폴더로</span>
        </Link>
      ) : (
        <Link
          href="/categories"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>카테고리 목록으로</span>
        </Link>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-8 flex-wrap">
        <Link
          href="/categories"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Home className="w-4 h-4" />
        </Link>
        {breadcrumbs.map((item) => (
          <span key={item.path} className="flex items-center gap-1">
            <ChevronRight className="w-4 h-4" />
            {item.isLast ? (
              <span className="font-medium text-gray-900 dark:text-white">
                {item.name}
              </span>
            ) : (
              <Link
                href={item.path}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {item.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-5xl">{icon}</span>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              {currentFolder}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {folders.length > 0 && `${folders.length}개의 폴더`}
              {folders.length > 0 && posts.length > 0 && ", "}
              {posts.length > 0 && `${posts.length}개의 글`}
            </p>
          </div>
        </div>
      </header>

      {/* README */}
      {readme && (
        <section className="mb-12">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <BookOpen className="w-4 h-4" />
            <span>README.md</span>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 md:p-8">
            <MarkdownRenderer content={readme} />
          </div>
        </section>
      )}

      {/* Subfolders */}
      {folders.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Folder className="w-5 h-5" />
            하위 폴더
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => (
              <Link
                key={folder.path}
                href={`/category/${folder.path
                  .split("/")
                  .map(encodeURIComponent)
                  .join("/")}`}
                className="group flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition-all"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Folder className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {folder.name}
                  </h3>
                  {folder.count !== undefined && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {folder.count}개의 글
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Posts in current folder */}
      {posts.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            📄 이 폴더의 글
          </h2>
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post.path} post={post} showCategory={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
