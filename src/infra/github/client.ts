import { Octokit } from "@octokit/rest";

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export const OWNER = process.env.GITHUB_OWNER || "jon890";
export const REPO = process.env.GITHUB_REPO || "fos-study";
export const BRANCH = process.env.GITHUB_BRANCH || "main";
