import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      SKIP_ENV_VALIDATION: "true",
      GITHUB_OWNER: "jon890",
      GITHUB_REPO: "fos-study",
      GITHUB_BRANCH: "main",
      NEXT_PUBLIC_SITE_URL: "https://fosworld.co.kr",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
