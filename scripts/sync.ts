import "dotenv/config";
import { syncGitHubToDatabase } from "../lib/sync-github";

// CLI에서 동기화 실행
async function main() {
  console.log("Starting sync...");

  try {
    const result = await syncGitHubToDatabase();
    console.log("Sync result:", result);
    process.exit(0);
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

main();
