import type { CSSProperties } from "react";
import { cache } from "react";
import { getRepositories } from "@/infra/db/repositories";
import { computeFolderPaths } from "@/lib/path-utils";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { BreadcrumbJsonLd } from "@/components/JsonLd";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CategoryDetailSubHero } from "@/components/CategoryDetailSubHero";
import { CategoriesSection } from "@/components/CategoriesSection";
import { SubfolderCard } from "@/components/SubfolderCard";
import { PostListRow } from "@/components/PostListRow";
import { ReadmeFrame } from "@/components/ReadmeFrame";
import { getCategoryColor } from "@/lib/category-meta";
import { notFound } from "next/navigation";
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

type FolderContents = Awaited<
  ReturnType<ReturnType<typeof getRepositories>["folder"]["getFolderContents"]>
>;

const getCachedFolderContents = cache(
  async (folderPath: string): Promise<FolderContents> => {
    try {
      const { folder } = getRepositories();
      return await folder.getFolderContents(folderPath);
    } catch (error) {
      log.warn(
        { err: error instanceof Error ? error : new Error(String(error)) },
        "Database not available",
      );
      return { folders: [], posts: [], readme: null };
    }
  },
);

export async function generateMetadata({
  params,
}: FolderPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path.map(decodeURIComponent);
  const currentFolder = pathSegments[pathSegments.length - 1];
  const folderPath = pathSegments.join("/");

  const { folders, posts, readme } = await getCachedFolderContents(folderPath);

  if (folders.length === 0 && posts.length === 0 && !readme) {
    return {
      title: "카테고리를 찾을 수 없습니다 | FOS Study",
      robots: { index: false, follow: false },
    };
  }

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

  const { folders, posts, readme } = await getCachedFolderContents(folderPath);

  // depth 1 (카테고리 루트)일 때만 cross-post 병합
  let mergedPosts = posts;
  if (pathSegments.length === 1) {
    try {
      const { post } = getRepositories();
      const crossPosts = await post.getCrossCategoryPosts(category);
      const seen = new Set(posts.map((p) => p.path));
      mergedPosts = [...posts, ...crossPosts.filter((p) => !seen.has(p.path))];
    } catch (error) {
      log.warn(
        { err: error instanceof Error ? error : new Error(String(error)) },
        "getCrossCategoryPosts 실패 — cross-post 없이 렌더",
      );
    }
  }

  if (folders.length === 0 && mergedPosts.length === 0 && !readme) {
    notFound();
  }

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

  const breadcrumbItems = [
    { label: "fos-blog", href: "/" },
    { label: "categories", href: "/categories" },
    ...pathSegments.map((seg, i) => ({
      label: seg,
      href:
        i === pathSegments.length - 1
          ? undefined
          : `/category/${pathSegments.slice(0, i + 1).map(encodeURIComponent).join("/")}`,
    })),
  ];

  const catColor = getCategoryColor(category);

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbJsonLdItems} />
      <Breadcrumb items={breadcrumbItems} />
      <CategoryDetailSubHero
        eyebrow={pathSegments.map((s) => s.toUpperCase()).join(" · ")}
        title={currentFolder}
        sublines={[
          ...(folders.length > 0 ? [{ num: folders.length, suffix: "폴더" }] : []),
          ...(mergedPosts.length > 0 ? [{ num: mergedPosts.length, suffix: "글" }] : []),
          `category/${pathSegments.join("/")}`,
        ]}
        categorySlug={category}
      />
      <main className="mx-auto max-w-[1180px] px-8 py-12 pb-20 space-y-14">
        {readme && (
          <CategoriesSection
            idx="README"
            title={`${currentFolder} 시리즈에 대하여`}
            meta="README.md"
          >
            <ReadmeFrame categorySlug={category}>
              <MarkdownRenderer
                content={stripLeadingH1(parseFrontMatter(readme).content)}
                basePath={`${folderPath}/README`}
              />
            </ReadmeFrame>
          </CategoriesSection>
        )}
        {folders.length > 0 && (
          <CategoriesSection
            idx="01"
            title="하위 폴더"
            meta={`${folders.length} folders`}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {folders.map((f) => (
                <SubfolderCard
                  key={f.path}
                  name={f.name}
                  href={`/category/${f.path.split("/").map(encodeURIComponent).join("/")}`}
                  count={f.count}
                  pathChip={
                    f.path.split("/").length > pathSegments.length + 1
                      ? f.path.split("/").slice(0, -1).join("/")
                      : undefined
                  }
                  categorySlug={category}
                />
              ))}
            </div>
          </CategoriesSection>
        )}
        {mergedPosts.length > 0 && (
          <CategoriesSection
            idx="02"
            title="이 폴더의 글"
            meta={`${mergedPosts.length} posts`}
          >
            <div
              className="post-list-rows"
              style={{ "--cat-color": catColor } as CSSProperties}
            >
              {mergedPosts.map((p, i) => (
                <PostListRow
                  key={p.path}
                  index={i + 1}
                  title={p.title}
                  excerpt={p.description ?? ""}
                  href={`/posts/${p.path.split("/").map(encodeURIComponent).join("/")}`}
                  updatedAt={p.updatedAt ?? null}
                  categorySlug={category}
                />
              ))}
            </div>
          </CategoriesSection>
        )}
      </main>
    </>
  );
}
