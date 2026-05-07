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
  const tag = decodeURIComponent(name);
  return {
    title: `#${tag}`,
    description: `${tag} 태그가 달린 글 모음`,
    alternates: { canonical: `${siteUrl}/tag/${encodeURIComponent(tag)}` },
    robots: { index: true, follow: true },
  };
}

export default async function TagPage({ params }: Props) {
  const { name } = await params;
  const tag = decodeURIComponent(name);
  const { post } = getRepositories();
  const [posts, total] = await Promise.all([
    post.getPostsByTag(tag, { limit: 50 }),
    post.countPostsByTag(tag),
  ]);

  if (total === 0) notFound();

  return (
    <div className="container mx-auto max-w-[1180px] px-4">
      <PostsListSubHero
        eyebrow="TAG"
        title={`#${tag}`}
        meta={`${total} POSTS`}
      />
      <ul className="grid grid-cols-1 gap-6 pb-16 md:grid-cols-2">
        {posts.map((p) => (
          <li key={p.path}>
            <PostCard post={p} variant="grid" />
          </li>
        ))}
      </ul>
    </div>
  );
}
