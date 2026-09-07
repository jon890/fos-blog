import type { Metadata } from "next";
import { getRepositories } from "@/infra/db/repositories";
import logger from "@/lib/logger";
import { PostsListSubHero } from "@/components/PostsListSubHero";
import { SeriesCard } from "@/components/SeriesCard";
import type { SeriesInfo } from "@/infra/db/types";
import { env } from "@/env";

const log = logger.child({ module: "app/series/page" });

const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const revalidate = 300;

export const metadata: Metadata = {
  title: "시리즈",
  description: "FOS Study 블로그의 모든 시리즈 모음",
  alternates: { canonical: `${siteUrl}/series` },
  openGraph: {
    title: "시리즈 | FOS Study",
    description: "FOS Study 블로그의 모든 시리즈 모음",
    url: `${siteUrl}/series`,
    type: "website",
  },
};

export default async function SeriesIndexPage() {
  let seriesList: SeriesInfo[] = [];

  try {
    const { post } = getRepositories();
    seriesList = await post.getAllSeries();
  } catch (error) {
    log.warn(
      { err: error instanceof Error ? error : new Error(String(error)) },
      "Database not available"
    );
  }

  return (
    <div className="container mx-auto max-w-[1180px] px-4">
      <PostsListSubHero
        eyebrow="SERIES"
        title="시리즈"
        meta={`${seriesList.length} SERIES`}
      />
      {seriesList.length === 0 ? (
        <div className="py-16 text-center text-[var(--color-fg-muted)]">
          아직 등록된 시리즈가 없습니다.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-6 pb-16 md:grid-cols-2">
          {seriesList.map((s) => (
            <li key={s.name}>
              <SeriesCard series={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
