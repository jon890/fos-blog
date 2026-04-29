import type { CSSProperties } from "react";
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

  try {
    const { folder } = getRepositories();
    folderContents = await folder.getFolderContents(folderPath);
  } catch (error) {
    log.warn({ err: error instanceof Error ? error : new Error(String(error)) }, "Database not available");
  }

  const { folders, posts, readme } = folderContents;

  if (folders.length === 0 && posts.length === 0 && !readme) {
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
          ...(posts.length > 0 ? [{ num: posts.length, suffix: "글" }] : []),
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
        {posts.length > 0 && (
          <CategoriesSection
            idx="02"
            title="이 폴더의 글"
            meta={`${posts.length} posts`}
          >
            <div
              className="post-list-rows"
              style={{ "--cat-color": catColor } as CSSProperties}
            >
              {posts.map((p, i) => (
                <PostListRow
                  key={p.path}
                  index={i + 1}
                  title={p.title}
                  excerpt={p.description ?? ""}
                  href={`/posts/${encodeURIComponent(p.path)}`}
                  updatedAt={p.updatedAt ?? new Date(0)}
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
