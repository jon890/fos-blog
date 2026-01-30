import { Octokit } from "@octokit/rest";
import { db } from "@/db";
import { posts, categories, syncLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { extractDescription } from "./markdown";

// DB가 설정되지 않으면 에러
function getDb() {
  if (!db) {
    throw new Error(
      "Database not configured. Set DATABASE_URL environment variable."
    );
  }
  return db;
}

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const OWNER = process.env.GITHUB_OWNER || "jon890";
const REPO = process.env.GITHUB_REPO || "fos-study";

// 카테고리 아이콘 매핑
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

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
  download_url?: string;
}

// GitHub에서 디렉토리 내용 가져오기
async function getDirectoryContents(path: string = ""): Promise<GitHubFile[]> {
  try {
    const response = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path,
    });

    if (Array.isArray(response.data)) {
      return response.data as GitHubFile[];
    }
    return [];
  } catch (error) {
    console.error(`Error fetching directory contents for ${path}:`, error);
    return [];
  }
}

// GitHub에서 파일 내용 가져오기
async function getFileContent(
  path: string
): Promise<{ content: string; sha: string } | null> {
  try {
    const response = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path,
    });

    if (!Array.isArray(response.data) && response.data.type === "file") {
      const content = Buffer.from(response.data.content, "base64").toString(
        "utf-8"
      );
      return { content, sha: response.data.sha };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching file content for ${path}:`, error);
    return null;
  }
}

// 재귀적으로 모든 마크다운 파일 수집
async function collectMarkdownFiles(
  path: string = "",
  files: Array<{
    name: string;
    path: string;
    sha: string;
    category: string;
    subcategory?: string;
    folders: string[];
  }> = []
): Promise<typeof files> {
  const contents = await getDirectoryContents(path);

  for (const item of contents) {
    if (item.name.startsWith(".")) continue;

    if (item.type === "dir") {
      await collectMarkdownFiles(item.path, files);
    } else if (
      item.type === "file" &&
      (item.name.endsWith(".md") || item.name.endsWith(".mdx"))
    ) {
      const pathParts = item.path.split("/");
      const category = pathParts[0] || "uncategorized";
      // folders: 카테고리와 파일명 사이의 모든 폴더 (n-depth 지원)
      const folders = pathParts.slice(1, -1);
      const subcategory = folders.length > 0 ? folders[0] : undefined;

      files.push({
        name: item.name,
        path: item.path,
        sha: item.sha,
        category,
        subcategory,
        folders,
      });
    }
  }

  return files;
}

// 동기화 실행
export async function syncGitHubToDatabase(): Promise<{
  added: number;
  updated: number;
  deleted: number;
}> {
  console.log("Starting GitHub to Database sync...");
  const database = getDb();

  let added = 0;
  let updated = 0;
  let deleted = 0;

  try {
    // 1. GitHub에서 모든 마크다운 파일 수집
    const githubFiles = await collectMarkdownFiles();
    console.log(`Found ${githubFiles.length} markdown files on GitHub`);

    // 2. 기존 DB 포스트 가져오기
    const existingPosts = await database.select().from(posts);
    const existingPathMap = new Map(existingPosts.map((p) => [p.path, p]));

    // 3. GitHub 파일들 처리
    const processedPaths = new Set<string>();

    for (const file of githubFiles) {
      processedPaths.add(file.path);
      const existing = existingPathMap.get(file.path);

      // SHA가 같으면 스킵 (변경 없음)
      if (existing && existing.sha === file.sha) {
        continue;
      }

      // 파일 내용 가져오기
      const fileData = await getFileContent(file.path);
      if (!fileData) continue;

      const title = file.name.replace(/\.(md|mdx)$/, "").replace(/_/g, " ");
      const description = extractDescription(fileData.content, 200);

      if (existing) {
        // 업데이트
        await database
          .update(posts)
          .set({
            title,
            content: fileData.content,
            description,
            sha: fileData.sha,
            category: file.category,
            subcategory: file.subcategory,
            folders: file.folders,
            updatedAt: new Date(),
          })
          .where(eq(posts.id, existing.id));
        updated++;
        console.log(`Updated: ${file.path}`);
      } else {
        // 새로 추가
        await database.insert(posts).values({
          title,
          path: file.path,
          slug: file.path,
          category: file.category,
          subcategory: file.subcategory,
          folders: file.folders,
          content: fileData.content,
          description,
          sha: fileData.sha,
        });
        added++;
        console.log(`Added: ${file.path}`);
      }
    }

    // 4. 삭제된 파일 처리
    for (const existing of existingPosts) {
      if (!processedPaths.has(existing.path)) {
        await database
          .update(posts)
          .set({ isActive: false })
          .where(eq(posts.id, existing.id));
        deleted++;
        console.log(`Deleted: ${existing.path}`);
      }
    }

    // 5. 카테고리 업데이트
    await updateCategories();

    // 6. 동기화 로그 저장
    await database.insert(syncLogs).values({
      status: "success",
      postsAdded: added,
      postsUpdated: updated,
      postsDeleted: deleted,
    });

    console.log(
      `Sync completed: ${added} added, ${updated} updated, ${deleted} deleted`
    );

    return { added, updated, deleted };
  } catch (error) {
    console.error("Sync failed:", error);

    await database.insert(syncLogs).values({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

// 카테고리 테이블 업데이트
async function updateCategories(): Promise<void> {
  const database = getDb();
  // 카테고리별 포스트 수 계산
  const categoryStats = await database
    .select({
      category: posts.category,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(posts)
    .where(eq(posts.isActive, true))
    .groupBy(posts.category);

  // 기존 카테고리 삭제 후 재생성
  await database.delete(categories);

  for (const stat of categoryStats) {
    await database.insert(categories).values({
      name: stat.category,
      slug: stat.category,
      icon: categoryIcons[stat.category] || "📁",
      postCount: stat.count,
    });
  }
}
