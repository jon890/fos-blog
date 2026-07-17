import { and, eq, isNotNull } from "drizzle-orm";
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
        categories: p.categories,
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

  async getAll(): Promise<Map<string, { id: number; sha: string | null }>> {
    const result = await this.db
      .select({ id: folders.id, path: folders.path, sha: folders.sha })
      .from(folders);
    return new Map(result.map((f) => [f.path, { id: f.id, sha: f.sha }]));
  }

  async getReadmeMentionSources(): Promise<
    Array<{ path: string; readme: string; updatedAt: Date | null }>
  > {
    const rows = await this.db
      .select({
        path: folders.path,
        readme: folders.readme,
        updatedAt: folders.updatedAt,
      })
      .from(folders)
      .where(isNotNull(folders.readme));
    return rows.flatMap((row) =>
      row.readme === null ? [] : [{ ...row, readme: row.readme }],
    );
  }

  async getReadmeMentionSource(
    folderPath: string,
  ): Promise<{ path: string; readme: string; updatedAt: Date | null } | null> {
    const rows = await this.db
      .select({
        path: folders.path,
        readme: folders.readme,
        updatedAt: folders.updatedAt,
      })
      .from(folders)
      .where(and(eq(folders.path, folderPath), isNotNull(folders.readme)))
      .limit(1);
    const row = rows[0];
    return row?.readme === null || row?.readme === undefined
      ? null
      : { ...row, readme: row.readme };
  }

  async upsert(folderPath: string, readme: string, sha: string): Promise<void> {
    const existing = await this.db
      .select({ id: folders.id })
      .from(folders)
      .where(eq(folders.path, folderPath))
      .limit(1);
    if (existing[0]) {
      await this.db
        .update(folders)
        .set({ readme, sha, updatedAt: new Date() })
        .where(eq(folders.id, existing[0].id));
    } else {
      await this.db.insert(folders).values({ path: folderPath, readme, sha });
    }
  }

  async ensureFolder(folderPath: string): Promise<void> {
    const existing = await this.db
      .select({ id: folders.id })
      .from(folders)
      .where(eq(folders.path, folderPath))
      .limit(1);
    if (!existing[0]) {
      await this.db.insert(folders).values({ path: folderPath, readme: null, sha: null });
    }
  }

  async clearReadme(folderPath: string): Promise<void> {
    await this.db
      .update(folders)
      .set({ readme: null, sha: null, updatedAt: new Date() })
      .where(eq(folders.path, folderPath));
  }

}
