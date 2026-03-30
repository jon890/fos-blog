import { createSyncService } from "@/services";
import { PostRepository } from "@/infra/db/repositories/PostRepository";
import { getDb } from "@/infra/db";

export async function syncGitHubToDatabase() {
  const syncService = createSyncService();
  return syncService.sync();
}

export async function retitleExistingPosts() {
  const postRepository = new PostRepository(getDb());
  return postRepository.retitleAll();
}
