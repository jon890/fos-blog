import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const LOOPBACK_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

/** HTTPS URL 하나. 개발과 테스트 편의를 위해 loopback HTTP만 함께 허용한다. */
export const careerStudyBackendUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && LOOPBACK_HOSTNAMES.includes(url.hostname);
  }, "HTTPS URL이거나 loopback HTTP URL이어야 합니다.");

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
    BETTER_AUTH_URL: z.string().optional(),
    BETTER_AUTH_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    ADMIN_GITHUB_USER_ID: z.string().optional(),
    STUDY_SERVICE_TOKEN: z.string().optional(),
    // career-os 학습자료 Backend. 운영은 HTTPS, 개발과 테스트는 loopback HTTP만 허용한다.
    CAREER_STUDY_BACKEND_URL: careerStudyBackendUrlSchema.optional(),
    // admin-gateway 권한 Bearer. 서버에서만 읽으며 브라우저로 내보내지 않는다.
    CAREER_STUDY_BACKEND_TOKEN: z.string().min(32).optional(),
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
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    ADMIN_GITHUB_USER_ID: process.env.ADMIN_GITHUB_USER_ID,
    STUDY_SERVICE_TOKEN: process.env.STUDY_SERVICE_TOKEN,
    CAREER_STUDY_BACKEND_URL: process.env.CAREER_STUDY_BACKEND_URL,
    CAREER_STUDY_BACKEND_TOKEN: process.env.CAREER_STUDY_BACKEND_TOKEN,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_GOOGLE_ADSENSE_ID: process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID,
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
