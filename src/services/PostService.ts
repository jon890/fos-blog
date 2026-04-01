import { extractTitle } from "@/lib/markdown";
import { PostRepository } from "@/infra/db/repositories/PostRepository";

export class PostService {
  constructor(private postRepo: PostRepository) {}

  async retitleAll(): Promise<{ total: number; updated: number; skipped: number }> {
    const allPosts = await this.postRepo.getAllWithContent();
    let updated = 0;
    let skipped = 0;

    for (const post of allPosts) {
      if (!post.content) {
        skipped++;
        continue;
      }
      const extractedTitle = extractTitle(post.content);
      if (!extractedTitle || extractedTitle === post.title) {
        skipped++;
        continue;
      }
      await this.postRepo.update(post.id, { title: extractedTitle });
      updated++;
    }

    return { total: allPosts.length, updated, skipped };
  }
}
