import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/env";
import { getRepositories } from "@/infra/db/repositories";
import { PostsListSubHero } from "@/components/PostsListSubHero";
import { PostCard } from "@/components/PostCard";
import logger from "@/lib/logger";

const log = logger.child({ module: "app/tag/[name]" });
const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const revalidate = 300;

interface Props {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const tag = decodeURIComponent(name);

  // 태그 이름은 임의 문자열이라 존재 여부를 확인하지 않으면
  // 아무 값이나 넣은 URL 이 모두 색인 허용 페이지가 된다.
  // 조회가 실패했을 때는 noindex 를 붙이지 않는다 —
  // 글이 멀쩡히 있는 태그가 DB 장애로 색인에서 빠지는 편이 더 나쁘다.
  let total: number | null = null;
  try {
    total = await getRepositories().post.countPostsByTag(tag);
  } catch (error) {
    log.warn(
      { err: error instanceof Error ? error : new Error(String(error)), tag },
      "태그 메타데이터 생성 실패",
    );
  }

  return {
    title: `#${tag}`,
    description: `${tag} 태그가 달린 글 모음`,
    alternates: { canonical: `${siteUrl}/tag/${encodeURIComponent(tag)}` },
    ...(total === 0 && { robots: { index: false, follow: false } }),
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
      <ul className="grid grid-cols-1 gap-6 pb-16 md:grid-cols-2 xl:grid-cols-3">
        {posts.map((p, index) => (
          <li key={p.path}>
            <PostCard post={p} variant="grid" preloadThumbnail={index === 0} />
          </li>
        ))}
      </ul>
    </div>
  );
}
