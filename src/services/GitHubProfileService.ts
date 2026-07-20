import logger from "@/lib/logger";

const log = logger.child({ module: "services/github-profile" });
const profileUrl = "https://api.github.com/users/jon890";

interface GitHubProfile {
  name: string | null;
  avatar_url: string;
  bio: string | null;
  html_url: string;
  public_repos: number;
  followers: number;
}

export interface ProfileData {
  name: string;
  handle: string;
  avatarUrl: string | null;
  bio: string;
  htmlUrl: string;
  publicRepos: number;
  followers: number;
}

const fallbackProfile: ProfileData = {
  name: "jon890",
  handle: "@jon890",
  avatarUrl: null,
  bio: "",
  htmlUrl: "https://github.com/jon890",
  publicRepos: 0,
  followers: 0,
};

function requestProfile(
  fetcher: typeof fetch,
  token?: string,
  revalidate = 3600,
) {
  return fetcher(profileUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    next: { revalidate },
  });
}

export async function fetchGitHubProfile(token: string, fetcher: typeof fetch = fetch): Promise<ProfileData> {
  try {
    let response = await requestProfile(fetcher, token);

    if (response.status === 401 || response.status === 403) {
      log.warn(
        { operation: "github-profile", status: response.status },
        "github token rejected, retrying public profile without authentication",
      );
      response = await requestProfile(fetcher, undefined, 60);
    }

    if (!response.ok) {
      const err = new Error(`GitHub API responded with status ${response.status}`);
      log.warn({ operation: "github-profile", err, status: response.status }, "github profile fetch failed");
      return fallbackProfile;
    }

    const data: GitHubProfile = await response.json();
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
    log.warn({ operation: "github-profile", err, status: 0 }, "github profile fetch failed");
    return fallbackProfile;
  }
}
