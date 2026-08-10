import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // Orca 가 만드는 자식 worktree. 그 안에서 각자 테스트를 돌린다.
    // 제외하지 않으면 부모에서 같은 테스트를 두 번 실행한다.
    exclude: ["**/node_modules/**", "**/dist/**", "worktrees/**"],
    env: {
      SKIP_ENV_VALIDATION: "true",
      GITHUB_OWNER: "jon890",
      GITHUB_REPO: "fos-study",
      GITHUB_BRANCH: "main",
      NEXT_PUBLIC_SITE_URL: "https://blog.fosworld.co.kr",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
