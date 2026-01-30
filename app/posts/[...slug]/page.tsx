import { getPost, getCategoryIcon, getAllPostPaths } from "@/lib/db-queries";
import {
  extractTitle,
  extractDescription,
  getReadingTime,
  generateTableOfContents,
  parseFrontMatter,
} from "@/lib/markdown";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { TableOfContents } from "@/components/TableOfContents";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Folder, Github } from "lucide-react";
import { Metadata } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://fos-blog.vercel.app";

// ISR - 60초마다 페이지 재생성
export const revalidate = 60;

interface PostPageProps {
  params: Promise<{
    slug: string[];
  }>;
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug.map(decodeURIComponent).join("/");
  const data = await getPost(slug);

  if (!data) {
    return {
      title: "글을 찾을 수 없습니다 - FOS Study",
    };
  }

  const title = extractTitle(data.content) || data.post.title;
  const description = extractDescription(data.content);

  return {
    title: `${title} - FOS Study`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
  };
}

export async function generateStaticParams() {
  const paths = await getAllPostPaths();
  return paths.map((path) => ({
    slug: path.split("/"),
  }));
}

export default async function PostPage({ params }: PostPageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug.map(decodeURIComponent).join("/");
  const data = await getPost(slug);

  if (!data) {
    notFound();
  }

  const { content, post } = data;
  const { content: mainContent } = parseFrontMatter(content);
  const title = extractTitle(content) || post.title;
  const readingTime = getReadingTime(content);
  const toc = generateTableOfContents(mainContent);

  const githubUrl = `https://github.com/jon890/fos-study/blob/main/${post.path}`;
  const postUrl = `${siteUrl}/posts/${post.path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const description = extractDescription(content);

  // Breadcrumb 데이터
  const breadcrumbItems = [
    { name: "홈", url: siteUrl },
    {
      name: post.category,
      url: `${siteUrl}/category/${encodeURIComponent(post.category)}`,
    },
    ...(post.subcategory
      ? [
          {
            name: post.subcategory,
            url: `${siteUrl}/category/${encodeURIComponent(
              post.category
            )}/${encodeURIComponent(post.subcategory)}`,
          },
        ]
      : []),
    { name: title, url: postUrl },
  ];

  return (
    <>
      {/* JSON-LD 구조화 데이터 */}
      <ArticleJsonLd
        url={postUrl}
        title={title}
        description={description}
        authorName="jon890"
        authorUrl="https://github.com/jon890"
      />
      <BreadcrumbJsonLd items={breadcrumbItems} />

      <div className="container mx-auto px-4 py-12">
        {/* Back button */}
        <Link
          href={`/category/${encodeURIComponent(post.category)}`}
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>목록으로 돌아가기</span>
        </Link>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content */}
          <article className="flex-grow min-w-0">
            {/* Header */}
            <header className="mb-8 pb-8 border-b border-gray-200 dark:border-gray-800">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Link
                  href={`/category/${encodeURIComponent(post.category)}`}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <span>{getCategoryIcon(post.category)}</span>
                  <span>{post.category}</span>
                </Link>
                {post.subcategory && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    / {post.subcategory}
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                {title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>약 {readingTime}분</span>
                </div>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Github className="w-4 h-4" />
                  <span>GitHub에서 보기</span>
                </a>
              </div>
            </header>

            {/* Content */}
            <MarkdownRenderer content={mainContent} />

            {/* Footer */}
            <footer className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Link
                  href={`/category/${encodeURIComponent(post.category)}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <Folder className="w-4 h-4" />
                  <span>{post.category} 카테고리의 다른 글 보기</span>
                </Link>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                >
                  <Github className="w-4 h-4" />
                  <span>수정 제안하기</span>
                </a>
              </div>
            </footer>
          </article>

          {/* Sidebar - Table of Contents */}
          {toc.length > 0 && (
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <TableOfContents toc={toc} />
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
