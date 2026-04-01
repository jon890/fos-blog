import { getDb } from "@/infra/db";
import * as githubApi from "@/infra/github/api";
import { PostRepository } from "@/infra/db/repositories/PostRepository";
import { CategoryRepository } from "@/infra/db/repositories/CategoryRepository";
import { FolderRepository } from "@/infra/db/repositories/FolderRepository";
import { SyncLogRepository } from "@/infra/db/repositories/SyncLogRepository";
import { PostSyncService } from "./PostSyncService";
import { MetadataSyncService } from "./MetadataSyncService";
import { SyncService } from "./SyncService";
import { PostService } from "./PostService";

export function createSyncService(): SyncService {
  const db = getDb();
  const postRepo = new PostRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const folderRepo = new FolderRepository(db);
  const syncLogRepo = new SyncLogRepository(db);

  return new SyncService(
    new PostSyncService(postRepo, githubApi),
    new MetadataSyncService(categoryRepo, folderRepo, postRepo, githubApi),
    postRepo,
    syncLogRepo,
    githubApi,
  );
}

export function createPostService(): PostService {
  const db = getDb();
  return new PostService(new PostRepository(db));
}

export { PostSyncService } from "./PostSyncService";
export { MetadataSyncService } from "./MetadataSyncService";
export { SyncService } from "./SyncService";
export { PostService } from "./PostService";
