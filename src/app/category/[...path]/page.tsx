import { getRepositories } from "@/infra/db/repositories";
import { computeFolderPaths } from "@/lib/path-utils";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "@/infra/db/constants";
import { PostCard } from "@/components/PostCard";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { BreadcrumbJsonLd } from "@/components/JsonLd";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Folder, ChevronRight, Home, BookOpen } from "lucide-react";
import { Metadata } from "next";
import { env } from "@/env";
import logger from "@/lib/logger";
import { parseFrontMatter, stripLeadingH1 } from "@/lib/markdown";

const log = logger.child({ module: "app/category/[...path]" });
const siteUrl = env.NEXT_PUBLIC_SITE_URL;

// ISR - 60초마다 페이지 재생성
export const revalidate = 60;

interface FolderPageProps {
  params: Promise<{
    path: string[];
  }>;
}

function getCategoryIcon(category: string): string {
  return categoryIcons[category] || DEFAULT_CATEGORY_ICON;
}

export async function generateMetadata({
  params,
}: FolderPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path.map(decodeURIComponent);
  const currentFolder = pathSegments[pathSegments.length - 1];
  const canonicalUrl = `${siteUrl}/category/${pathSegments
    .map(encodeURIComponent)
    .join("/")}`;
  const description = `${pathSegments.join(" > ")} 폴더의 모든 글을 확인하세요.`;

  return {
    title: currentFolder,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${currentFolder} | FOS Study`,
      description,
      url: canonicalUrl,
      type: "website",
      images: [
        {
          url: `${siteUrl}/api/og/category/${pathSegments.map(encodeURIComponent).join("/")}`,
          width: 1200,
          height: 630,
          alt: `${currentFolder} | FOS Study`,
        },
      ],
    },
  };
}

export async function generateStaticParams() {
  try {
    const { post } = getRepositories();
    const postPaths = await post.getAllPostPaths();
    return computeFolderPaths(postPaths).map((segments) => ({ path: segments }));
  } catch {
    return [];
  }
}

export default async function FolderPage({ params }: FolderPageProps) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path.map(decodeURIComponent);
  const folderPath = pathSegments.join("/");
  const category = pathSegments[0];
  const currentFolder = pathSegments[pathSegments.length - 1];

  let folderContents = { folders: [], posts: [], readme: null } as Awaited<
    ReturnType<ReturnType<typeof getRepositories>["folder"]["getFolderContents"]>
  >;
  let visitCounts: Record<string, number> = {};

  try {
    const { folder, visit } = getRepositories();
    folderContents = await folder.getFolderContents(folderPath);

    const postPaths = folderContents.posts.map((p) => p.path);
    if (postPaths.length > 0) {
      visitCounts = await visit.getPostVisitCounts(postPaths);
    }
  } catch (error) {
    log.warn({ err: error instanceof Error ? error : new Error(String(error)) }, "Database not available");
  }

  const { folders, posts, readme } = folderContents;

  if (folders.length === 0 && posts.length === 0 && !readme) {
    notFound();
  }

  const icon = getCategoryIcon(category);

  const breadcrumbs = pathSegments.map((segment, index) => ({
    name: segment,
    path: `/category/${pathSegments
      .slice(0, index + 1)
      .map(encodeURIComponent)
      .join("/")}`,
    isLast: index === pathSegments.length - 1,
  }));

  const breadcrumbJsonLdItems = [
    { name: "홈", url: siteUrl },
    ...pathSegments.map((segment, index) => ({
      name: segment,
      url: `${siteUrl}/category/${pathSegments
        .slice(0, index + 1)
        .map(encodeURIComponent)
        .join("/")}`,
    })),
  ];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbJsonLdItems} />
      <div className="container mx-auto px-4 py-6 md:py-12">
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

        {readme && (
          <section className="mb-12">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
              <BookOpen className="w-4 h-4" />
              <span>README.md</span>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 md:p-8">
              <MarkdownRenderer content={stripLeadingH1(parseFrontMatter(readme).content)} basePath={`${folderPath}/README`} />
            </div>
          </section>
        )}

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

        {posts.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              📄 이 폴더의 글
            </h2>
            <div className="space-y-3">
              {posts.map((post) => (
                <PostCard
                  key={post.path}
                  post={post}
                  showCategory={false}
                  viewCount={visitCounts[post.path] ?? 0}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
