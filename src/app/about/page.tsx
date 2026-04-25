import type { Metadata } from "next";
import Image from "next/image";
import { env } from "@/env";
import logger from "@/lib/logger";

const log = logger.child({ module: "app/about" });

export const revalidate = 3600;

const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: "소개",
  description: "FOS Study 블로그와 운영자를 소개합니다.",
  alternates: {
    canonical: `${siteUrl}/about`,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "소개 | FOS Study",
    description: "FOS Study 블로그와 운영자를 소개합니다.",
    url: `${siteUrl}/about`,
    type: "website",
  },
};

interface GitHubProfile {
  name: string | null;
  avatar_url: string;
  bio: string | null;
  html_url: string;
  public_repos: number;
  followers: number;
}

interface ProfileData {
  name: string;
  avatarUrl: string | null;
  bio: string;
  htmlUrl: string;
  publicRepos: number;
  followers: number;
}

async function fetchGitHubProfile(): Promise<ProfileData> {
  try {
    const res = await fetch("https://api.github.com/users/jon890", {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json" },
    });

    if (!res.ok) {
      const err = new Error(`GitHub API responded with status ${res.status}`);
      log.warn({ component: "about", operation: "github-profile", err, status: res.status }, "github profile fetch failed");
      return {
        name: "jon890",
        avatarUrl: null,
        bio: "",
        htmlUrl: "https://github.com/jon890",
        publicRepos: 0,
        followers: 0,
      };
    }

    const data: GitHubProfile = await res.json();
    return {
      name: data.name ?? "jon890",
      avatarUrl: data.avatar_url,
      bio: data.bio ?? "",
      htmlUrl: data.html_url,
      publicRepos: data.public_repos,
      followers: data.followers,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.warn({ component: "about", operation: "github-profile", err, status: 0 }, "github profile fetch failed");
    return {
      name: "jon890",
      avatarUrl: null,
      bio: "",
      htmlUrl: "https://github.com/jon890",
      publicRepos: 0,
      followers: 0,
    };
  }
}

export default async function AboutPage() {
  const profile = await fetchGitHubProfile();

  return (
    <div className="container mx-auto px-4 py-6 md:py-12">
      <div className="max-w-3xl mx-auto">
        {/* Profile Card */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 rounded-lg border border-gray-200 dark:border-gray-700 mb-10">
          {profile.avatarUrl && (
            <Image
              src={profile.avatarUrl}
              alt={`${profile.name} GitHub 프로필 사진`}
              width={96}
              height={96}
              className="rounded-full"
            />
          )}
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {profile.name}
            </h1>
            {profile.bio && (
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                {profile.bio}
              </p>
            )}
            <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
              {profile.publicRepos > 0 && (
                <span>공개 저장소 {profile.publicRepos}개</span>
              )}
              {profile.followers > 0 && (
                <span>팔로워 {profile.followers}명</span>
              )}
            </div>
            <a
              href={profile.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${profile.name} GitHub 프로필 열기 (새 탭)`}
              className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
            >
              GitHub 프로필 →
            </a>
          </div>
        </div>

        {/* Blog Introduction */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            블로그 소개
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            FOS Study는 개발 학습 과정에서 익힌 내용을 기록하는 블로그입니다.
            알고리즘 풀이, 자료구조 정리, 다양한 기술 스택 학습 내용을
            꾸준히 업로드합니다.
          </p>
        </section>

        {/* Topics */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            다루는 주제
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              "AI",
              "알고리즘",
              "자료구조",
              "데이터베이스",
              "DevOps",
              "Java / Spring",
              "JavaScript / TypeScript",
              "React",
              "Next.js",
            ].map((topic) => (
              <li
                key={topic}
                className="px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
              >
                {topic}
              </li>
            ))}
          </ul>
        </section>

        {/* Tech Stack */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            블로그 기술 스택
          </h2>
          <ul className="space-y-1 text-gray-600 dark:text-gray-400">
            <li>Next.js 16 (App Router)</li>
            <li>TypeScript</li>
            <li>MySQL + Drizzle ORM</li>
            <li>Tailwind CSS 4</li>
          </ul>
        </section>

        {/* Content Source */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            콘텐츠 소스
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            이 블로그의 글은{" "}
            <a
              href="https://github.com/jon890/fos-study"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              jon890/fos-study
            </a>{" "}
            리포지터리에서 자동으로 동기화됩니다. Markdown 파일이 업데이트되면
            블로그에 자동 반영됩니다.
          </p>
        </section>
      </div>
    </div>
  );
}
