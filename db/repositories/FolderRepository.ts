import { eq } from "drizzle-orm";
import { posts, folders } from "../schema";
import type { PostData, FolderItemData, FolderContentsResult } from "../types";
import { BaseRepository } from "./BaseRepository";

export class FolderRepository extends BaseRepository {
  async getFolderContents(folderPath: string): Promise<FolderContentsResult> {
    const pathParts = folderPath.split("/").filter(Boolean);
    const depth = pathParts.length;

    const allPosts = await this.db
      .select()
      .from(posts)
      .where(eq(posts.isActive, true));

    const matchingPosts = allPosts.filter((post) => {
      return post.path.startsWith(folderPath + "/");
    });

    const directPosts = matchingPosts.filter((post) => {
      const postPathParts = post.path.split("/");
      const postFolderDepth = postPathParts.length - 1;
      return postFolderDepth === depth;
    });

    const subfolderMap = new Map<string, number>();
    for (const post of matchingPosts) {
      const postPathParts = post.path.split("/");
      if (postPathParts.length > depth + 1) {
        const subfolder = postPathParts[depth];
        const subfolderPath = [...pathParts, subfolder].join("/");
        subfolderMap.set(
          subfolderPath,
          (subfolderMap.get(subfolderPath) || 0) + 1
        );
      }
    }

    const foldersData: FolderItemData[] = Array.from(subfolderMap.entries())
      .map(([path, count]) => ({
        name: path.split("/").pop() || "",
        type: "folder" as const,
        path,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const postsData: PostData[] = directPosts
      .map((p) => ({
        title: p.title,
        path: p.path,
        slug: p.slug,
        category: p.category,
        subcategory: p.subcategory,
        folders: p.folders || [],
        description: p.description,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    const folderRecord = await this.db
      .select({ readme: folders.readme })
      .from(folders)
      .where(eq(folders.path, folderPath))
      .limit(1);

    const readme = folderRecord[0]?.readme || null;

    return { folders: foldersData, posts: postsData, readme };
  }

  async getAllFolderPaths(): Promise<string[][]> {
    const allPosts = await this.db
      .select({ path: posts.path })
      .from(posts)
      .where(eq(posts.isActive, true));

    const folderPaths = new Set<string>();

    for (const post of allPosts) {
      const parts = post.path.split("/");
      for (let i = 1; i <= parts.length - 1; i++) {
        const folderPath = parts.slice(0, i).join("/");
        if (folderPath) {
          folderPaths.add(folderPath);
        }
      }
    }

    return Array.from(folderPaths)
      .sort()
      .map((path) => path.split("/"));
  }
}
