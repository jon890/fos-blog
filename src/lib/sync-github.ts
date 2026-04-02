import type { SyncService } from "@/services";
import { createSyncService } from "@/services";

export async function syncGitHubToDatabase(): ReturnType<SyncService["sync"]> {
  return createSyncService().sync();
}
