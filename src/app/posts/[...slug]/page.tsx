import { getRepositories } from "@/infra/db/repositories";
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
import { ReadingProgressBar } from "@/components/ReadingProgressBar";
import { MobileTocButton } from "@/components/MobileTocButton";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { Comments } from "@/components/Comments";
import { ArticleHero } from "@/components/ArticleHero";
import { ArticleFooter } from "@/components/ArticleFooter";
import { notFound } from "next/navigation";
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

  const { post: postRepo, visit } = getRepositories();

  let data: { content: string; post: PostData } | null = null;
  try {
    data = await postRepo.getPost(slug);
  } catch {
    notFound();
  }

  if (!data) {
    notFound();
  }

  const { content, post: postData } = data;
  const { content: contentWithoutFrontmatter, frontMatter } =
    parseFrontMatter(content);
  const stripped = stripLeadingH1(contentWithoutFrontmatter);
  const title = extractTitle(content) || postData.title;
  const readTime = getReadingTime(stripped);
  const tocItems = generateTableOfContents(stripped).filter(
    (i) => i.level === 2 || i.level === 3
  );

  const seriesNeighbors =
    postData.series && postData.seriesOrder != null
      ? await postRepo.getSeriesNeighbors(postData)
      : { prev: null, next: null, total: 0 };

  // seriesOrder == 0 이 valid 한 경우를 위해 != null 사용
  const seriesMeta =
    postData.series && postData.seriesOrder != null && seriesNeighbors.total > 0
      ? {
          name: postData.series,
          order: postData.seriesOrder,
          total: seriesNeighbors.total,
        }
      : null;

  const prevInSeries = seriesNeighbors.prev
    ? { title: seriesNeighbors.prev.title, slug: seriesNeighbors.prev.slug }
    : null;
  const nextInSeries = seriesNeighbors.next
    ? { title: seriesNeighbors.next.title, slug: seriesNeighbors.next.slug }
    : null;

  const viewCount = await visit.getVisitCount(postData.path);
  const desc = extractDescription(content);

  const postUrl = `${siteUrl}/posts/${postData.path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const breadcrumbJsonLdItems = [
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

  const heroBreadcrumb = [
    { label: "fos-blog", href: "/" },
    {
      label: postData.category,
      href: `/category/${encodeURIComponent(postData.category)}`,
    },
    {
      label: title.length > 24 ? `${title.slice(0, 24)}…` : title,
    },
  ];

  return (
    <>
      <ReadingProgressBar />
      <ArticleJsonLd
        url={postUrl}
        title={title}
        description={desc}
        datePublished={postData.createdAt?.toISOString()}
        dateModified={postData.updatedAt?.toISOString()}
        authorName="jon890"
        authorUrl="https://github.com/jon890"
      />
      <BreadcrumbJsonLd items={breadcrumbJsonLdItems} />

      <ArticleHero
        category={postData.category}
        title={title}
        description={desc}
        createdAt={postData.createdAt ?? null}
        readTimeMinutes={readTime}
        viewCount={viewCount}
        breadcrumb={heroBreadcrumb}
        series={seriesMeta}
      />

      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-6 py-12 md:grid-cols-[1fr_minmax(0,820px)_240px] md:gap-12 md:py-16">
        <div className="hidden md:block" aria-hidden />
        <article className="min-w-0">
          <MarkdownRenderer content={stripped} basePath={slug} />
        </article>
        <aside className="hidden md:block">
          <TableOfContents toc={tocItems} />
        </aside>
      </div>

      <MobileTocButton toc={tocItems} />

      <ArticleFooter
        tags={frontMatter.tags}
        series={postData.series}
        prevInSeries={prevInSeries}
        nextInSeries={nextInSeries}
      />

      <div className="mx-auto max-w-[880px] px-6 pb-12">
        <Comments postSlug={postData.path} />
      </div>
    </>
  );
}
