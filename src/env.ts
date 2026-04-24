import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // 필수 — 없으면 startup에서 throw
    GITHUB_TOKEN: z.string().min(1),
    DATABASE_URL: z.string().url().optional(),
    SYNC_API_KEY: z.string().min(1),

    // 선택 (기본값 있음)
    GITHUB_OWNER: z.string().default("jon890"),
    GITHUB_REPO: z.string().default("fos-study"),
    GITHUB_BRANCH: z.string().default("main"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // 선택
    USE_FULLTEXT_SEARCH: z.string().optional(),
    LOG_LEVEL: z.string().optional(),
  },
  client: {
    // 선택 (기본값 있음)
    NEXT_PUBLIC_SITE_URL: z.string().url().default("https://blog.fosworld.co.kr"),

    // 선택
    NEXT_PUBLIC_GOOGLE_ADSENSE_ID: z.string().optional(),
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: z.string().optional(),
  },
  runtimeEnv: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    DATABASE_URL: process.env.DATABASE_URL,
    SYNC_API_KEY: process.env.SYNC_API_KEY,
    GITHUB_OWNER: process.env.GITHUB_OWNER,
    GITHUB_REPO: process.env.GITHUB_REPO,
    GITHUB_BRANCH: process.env.GITHUB_BRANCH,
    NODE_ENV: process.env.NODE_ENV,
    USE_FULLTEXT_SEARCH: process.env.USE_FULLTEXT_SEARCH,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_GOOGLE_ADSENSE_ID: process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID,
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
