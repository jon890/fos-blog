import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/env";
import { getRepositories } from "@/infra/db/repositories";
import { PostsListSubHero } from "@/components/PostsListSubHero";
import { PostCard } from "@/components/PostCard";

const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const revalidate = 300;

interface Props {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const series = decodeURIComponent(name);
  const url = `${siteUrl}/series/${encodeURIComponent(series)}`;
  return {
    title: `시리즈: ${series}`,
    description: `${series} 시리즈 글 모음`,
    alternates: { canonical: url },
    openGraph: {
      title: `시리즈: ${series}`,
      description: `${series} 시리즈 글 모음`,
      url,
      type: "website",
    },
  };
}

export default async function SeriesPage({ params }: Props) {
  const { name } = await params;
  const series = decodeURIComponent(name);
  const { post } = getRepositories();
  const seriesPosts = await post.getPostsBySeries(series);
  if (seriesPosts.length === 0) notFound();

  return (
    <div className="container mx-auto max-w-[1180px] px-4">
      <PostsListSubHero
        eyebrow="SERIES"
        title={series}
        meta={`${seriesPosts.length} POSTS`}
      />
      <ol className="grid grid-cols-1 gap-6 pb-16 md:grid-cols-2">
        {seriesPosts.map((p, i) => (
          <li key={p.path} className="relative">
            <span className="absolute -left-2 -top-2 z-10 font-mono text-[11px] text-[var(--color-fg-muted)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <PostCard post={p} variant="grid" />
          </li>
        ))}
      </ol>
    </div>
  );
}
