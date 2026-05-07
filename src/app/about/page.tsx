import type { Metadata } from "next";
import { env } from "@/env";
import logger from "@/lib/logger";
import { createDefaultStatsService } from "@/services/StatsService";
import { ProfileCard } from "@/components/about/ProfileCard";
import { SiteStats } from "@/components/about/SiteStats";
import { StackGrid, STACK } from "@/components/about/StackGrid";
import { LinksGrid } from "@/components/about/LinksGrid";
import "./about.css";

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
  handle: string;
  avatarUrl: string | null;
  bio: string;
  htmlUrl: string;
  publicRepos: number;
  followers: number;
}

async function fetchGitHubProfile(): Promise<ProfileData> {
  try {
    const res = await fetch("https://api.github.com/users/jon890", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const err = new Error(`GitHub API responded with status ${res.status}`);
      log.warn({ component: "about", operation: "github-profile", err, status: res.status }, "github profile fetch failed");
      return {
        name: "jon890",
        handle: "@jon890",
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
      handle: "@jon890",
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
      handle: "@jon890",
      avatarUrl: null,
      bio: "",
      htmlUrl: "https://github.com/jon890",
      publicRepos: 0,
      followers: 0,
    };
  }
}

interface SectionProps {
  idx: string;
  label: string;
  right?: string;
  children: React.ReactNode;
}

function Section({ idx, label, right, children }: SectionProps) {
  return (
    <section className="ab-section">
      <div className="ab-section-head">
        <span className="h2">
          <span className="idx">{idx}</span>
          <span>{label}</span>
        </span>
        {right && <span className="right">{right}</span>}
      </div>
      {children}
    </section>
  );
}

async function fetchSiteStats() {
  try {
    return await createDefaultStatsService().getAboutStats();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.warn({ component: "about", operation: "site-stats", err }, "site stats fetch failed, using fallback");
    return { postCount: 0, categoryCount: 0, lastSyncAt: null };
  }
}

export default async function AboutPage() {
  const [profile, stats] = await Promise.all([
    fetchGitHubProfile(),
    fetchSiteStats(),
  ]);

  return (
    <div className="ab-shell">
      <header className="ab-subhero">
        <div className="ab-container">
          <span className="ab-eyebrow">ABOUT</span>
          <h1 className="ab-title">FOS Study</h1>
          <p className="ab-meta">
            한 명의 백엔드 엔지니어가 매일 쌓는 학습 노트.
            공부하면서 기록하고, 기록하면서 다시 배웁니다.
          </p>
        </div>
      </header>
      <main className="ab-container">
        <Section idx="01" label="profile">
          <ProfileCard {...profile} />
        </Section>
        <Section idx="02" label="site stats" right="snapshot">
          <SiteStats {...stats} />
        </Section>
        <Section idx="03" label="stack" right={`${STACK.length} packages`}>
          <StackGrid />
        </Section>
        <Section idx="04" label="links" right="external">
          <LinksGrid />
        </Section>
        <div className="ab-end">
          <span>fos-blog · /about</span>
          <span>© {new Date().getFullYear()} jon890</span>
        </div>
      </main>
    </div>
  );
}
