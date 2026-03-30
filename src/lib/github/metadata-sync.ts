import { eq, sql } from "drizzle-orm";
import { posts, categories, folders } from "@/db/schema";
import { getDb } from "./client";
import { getFileContent } from "./api";

const categoryIcons: Record<string, string> = {
  AI: "🤖",
  algorithm: "🧮",
  architecture: "🏗️",
  database: "🗄️",
  devops: "🚀",
  finance: "💰",
  git: "📝",
  go: "🐹",
  html: "🌐",
  http: "📡",
  internet: "🌍",
  interview: "💼",
  java: "☕",
  javascript: "⚡",
  kafka: "📨",
  network: "🔌",
  react: "⚛️",
  redis: "🔴",
  resume: "📄",
  css: "🎨",
  기술공유: "📢",
};

export async function updateCategories(): Promise<void> {
  const database = getDb();
  const categoryStats = await database
    .select({
      category: posts.category,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(posts)
    .where(eq(posts.isActive, true))
    .groupBy(posts.category);

  await database.transaction(async (tx) => {
    await tx.delete(categories);
    for (const stat of categoryStats) {
      await tx.insert(categories).values({
        name: stat.category,
        slug: stat.category,
        icon: categoryIcons[stat.category] || "📁",
        postCount: stat.count,
      });
    }
  });
}

export async function syncFolderReadmes(): Promise<void> {
  const database = getDb();
  console.log("폴더 README 동기화 중...");

  const allPosts = await database
    .select({ path: posts.path })
    .from(posts)
    .where(eq(posts.isActive, true));

  const folderPaths = new Set<string>();
  for (const post of allPosts) {
    const parts = post.path.split("/");
    for (let i = 1; i <= parts.length - 1; i++) {
      const folderPath = parts.slice(0, i).join("/");
      if (folderPath) folderPaths.add(folderPath);
    }
  }

  const existingFolders = await database.select().from(folders);
  const existingFolderMap = new Map(existingFolders.map((f) => [f.path, f]));
  const readmeNames = ["README.md", "readme.md", "README.MD", "Readme.md"];
  let synced = 0;

  for (const folderPath of folderPaths) {
    let readmeContent: { content: string; sha: string } | null = null;
    for (const readmeName of readmeNames) {
      const result = await getFileContent(`${folderPath}/${readmeName}`);
      if (result) {
        readmeContent = result;
        break;
      }
    }

    const existing = existingFolderMap.get(folderPath);

    if (readmeContent) {
      if (existing && existing.sha === readmeContent.sha) continue;

      if (existing) {
        await database
          .update(folders)
          .set({ readme: readmeContent.content, sha: readmeContent.sha, updatedAt: new Date() })
          .where(eq(folders.id, existing.id));
      } else {
        await database.insert(folders).values({
          path: folderPath,
          readme: readmeContent.content,
          sha: readmeContent.sha,
        });
      }
      synced++;
      console.log(`README 동기화: ${folderPath}`);
    } else if (!existing) {
      await database.insert(folders).values({ path: folderPath, readme: null, sha: null });
    }
  }

  console.log(`폴더 README ${synced}개 동기화 완료`);
}
