import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      GITHUB_TOKEN: "test-github-token",
      DATABASE_URL: "mysql://fos_user:fos_password@localhost:13307/fos_blog",
      SYNC_API_KEY: "test-sync-key",
      GITHUB_OWNER: "jon890",
      GITHUB_REPO: "fos-study",
      GITHUB_BRANCH: "main",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
