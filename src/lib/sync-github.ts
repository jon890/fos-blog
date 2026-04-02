import { createSyncService } from "@/services";

export async function syncGitHubToDatabase() {
  return createSyncService().sync();
}
