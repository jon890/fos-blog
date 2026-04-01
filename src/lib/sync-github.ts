import { createSyncService, createPostService } from "@/services";

export async function syncGitHubToDatabase() {
  return createSyncService().sync();
}

export async function retitleExistingPosts() {
  return createPostService().retitleAll();
}
