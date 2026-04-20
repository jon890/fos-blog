import { getRepositories } from "@/infra/db/repositories";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "@/infra/db/constants";
import type { PostData } from "@/infra/db/types";
import {
  extractTitle,
  extractDescription,
  getReadingTime,
  generateTableOfContents,
  parseFrontMatter,
  stripLeadingH1,
} from "@/lib/markdown";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { TableOfContents } from "@/components/TableOfContents";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { Comments } from "@/components/Comments";
import { PostViewCount } from "@/components/PostViewCount";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, Folder, Github, Pencil } from "lucide-react";
import { Metadata } from "next";
import { env } from "@/env";

const siteUrl = env.NEXT_PUBLIC_SITE_URL;

// ISR - 60초마다 페이지 재생성
export const revalidate = 60;

interface PostPageProps {
  params: Promise<{
    slug: string[];
  }>;
}

function getCategoryIcon(category: string): string {
  return categoryIcons[category] || DEFAULT_CATEGORY_ICON;
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug.map(decodeURIComponent).join("/");

  try {
    const { post } = getRepositories();
    const data = await post.getPost(slug);

    if (!data) {
      return { title: "글을 찾을 수 없습니다" };
    }

    const title = extractTitle(data.content) || data.post.title;
    const description = extractDescription(data.content);
    const postUrl = `${siteUrl}/posts/${slug
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    const publishedTime = data.post.createdAt?.toISOString();
    const modifiedTime = data.post.updatedAt?.toISOString();

    const ogImageUrl = `${siteUrl}/api/og/posts/${slug.split("/").map(encodeURIComponent).join("/")}`;

    return {
      title,
      description,
      alternates: { canonical: postUrl },
      openGraph: {
        title,
        description,
        type: "article",
        url: postUrl,
        ...(publishedTime && { publishedTime }),
        ...(modifiedTime && { modifiedTime }),
        images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImageUrl],
      },
    };
  } catch {
    return { title: "글을 찾을 수 없습니다" };
  }
}

export async function generateStaticParams() {
  try {
    const { post } = getRepositories();
    const paths = await post.getAllPostPaths();
    return paths.map((path) => ({ slug: path.split("/") }));
  } catch {
    return [];
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug.map(decodeURIComponent).join("/");

  let data: { content: string; post: PostData } | null = null;
  try {
    const { post } = getRepositories();
    data = await post.getPost(slug);
  } catch {
    notFound();
  }

  if (!data) {
    notFound();
  }

  const { content, post: postData } = data;
  const { content: contentWithoutFrontmatter } = parseFrontMatter(content);
  const mainContent = stripLeadingH1(contentWithoutFrontmatter);
  const title = extractTitle(content) || postData.title;
  const readingTime = getReadingTime(content);
  const toc = generateTableOfContents(mainContent);

  const githubUrl = `https://github.com/jon890/fos-study/blob/main/${postData.path}`;
  const postUrl = `${siteUrl}/posts/${postData.path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const description = extractDescription(content);

  const breadcrumbItems = [
    { name: "홈", url: siteUrl },
    {
      name: postData.category,
      url: `${siteUrl}/category/${encodeURIComponent(postData.category)}`,
    },
    ...(postData.subcategory
      ? [
          {
            name: postData.subcategory,
            url: `${siteUrl}/category/${encodeURIComponent(
              postData.category
            )}/${encodeURIComponent(postData.subcategory)}`,
          },
        ]
      : []),
    { name: title, url: postUrl },
  ];

  return (
    <>
      <ArticleJsonLd
        url={postUrl}
        title={title}
        description={description}
        datePublished={postData.createdAt?.toISOString()}
        dateModified={postData.updatedAt?.toISOString()}
        authorName="jon890"
        authorUrl="https://github.com/jon890"
      />
      <BreadcrumbJsonLd items={breadcrumbItems} />

      <div className="container mx-auto px-4 py-6 md:py-12">
        <Link
          href={`/category/${encodeURIComponent(postData.category)}`}
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>목록으로 돌아가기</span>
        </Link>

        <div className="flex flex-col lg:flex-row gap-8">
          <article className="flex-grow min-w-0">
            <header className="mb-8 pb-8 border-b border-gray-200 dark:border-gray-800">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Link
                  href={`/category/${encodeURIComponent(postData.category)}`}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <span>{getCategoryIcon(postData.category)}</span>
                  <span>{postData.category}</span>
                </Link>
                {postData.subcategory && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    / {postData.subcategory}
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                {title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>약 {readingTime}분</span>
                </div>
                {postData.createdAt && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {postData.createdAt.toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                )}
                {postData.updatedAt &&
                  postData.createdAt?.getTime() !== postData.updatedAt.getTime() && (
                    <div className="flex items-center gap-2">
                      <Pencil className="w-4 h-4" />
                      <span>
                        {postData.updatedAt.toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                        {"  수정"}
                      </span>
                    </div>
                  )}
                <PostViewCount
                  pagePath={postData.path}
                  className="text-gray-600 dark:text-gray-400"
                />
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

            <MarkdownRenderer content={mainContent} basePath={slug} />

            <footer className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Link
                  href={`/category/${encodeURIComponent(postData.category)}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <Folder className="w-4 h-4" />
                  <span>{postData.category} 카테고리의 다른 글 보기</span>
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

            <Comments postSlug={postData.path} />
          </article>

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
