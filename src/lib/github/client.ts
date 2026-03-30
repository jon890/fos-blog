import { Octokit } from "@octokit/rest";
import { getDb as getDbInstance } from "@/db";
import { env } from "@/env";

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
  auth: env.GITHUB_TOKEN,
});

export const OWNER = env.GITHUB_OWNER;
export const REPO = env.GITHUB_REPO;
export const BRANCH = env.GITHUB_BRANCH;
