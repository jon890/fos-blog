import { Octokit } from "@octokit/rest";
import { getDb as getDbInstance } from "@/db";

export function getDb() {
  const db = getDbInstance();
  if (!db) {
    throw new Error(
      "Database not configured. Set DATABASE_URL environment variable."
    );
  }
  return db;
}

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export const OWNER = process.env.GITHUB_OWNER || "jon889";
export const REPO = process.env.GITHUB_REPO || "fos-study";
export const BRANCH = process.env.GITHUB_BRANCH || "main";
