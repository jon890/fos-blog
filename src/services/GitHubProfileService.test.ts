import { describe, expect, it, vi } from "vitest";
import { fetchGitHubProfile } from "./GitHubProfileService";

const profile = {
  name: "FOS",
  avatar_url: "https://example.com/avatar.png",
  bio: "Developer",
  html_url: "https://github.com/jon890",
  public_repos: 42,
  followers: 7,
};

describe("fetchGitHubProfile", () => {
  it("인증 요청이 성공하면 GitHub 프로필을 반환한다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }));

    const result = await fetchGitHubProfile("valid-token", fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer valid-token" });
    expect(result).toEqual({
      name: "FOS",
      handle: "@jon890",
      avatarUrl: "https://example.com/avatar.png",
      bio: "Developer",
      htmlUrl: "https://github.com/jon890",
      publicRepos: 42,
      followers: 7,
    });
  });

  it("토큰이 거부되면 인증 없이 공개 프로필을 재요청한다", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(profile), { status: 200 }));

    const result = await fetchGitHubProfile("expired-token", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer expired-token" });
    expect(fetcher.mock.calls[1]?.[1]?.headers).not.toHaveProperty("Authorization");
    expect(result.name).toBe("FOS");
  });

  it("재요청도 실패하면 기본 프로필을 반환한다", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));

    const result = await fetchGitHubProfile("expired-token", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      name: "jon890",
      handle: "@jon890",
      avatarUrl: null,
      bio: "",
      htmlUrl: "https://github.com/jon890",
      publicRepos: 0,
      followers: 0,
    });
  });
});
