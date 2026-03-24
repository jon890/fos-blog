import { Octokit } from "@octokit/rest";
import { getDb as getDbInstance } from "@/db";
import { posts, categories, syncLogs, folders } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { extractDescription, extractTitle } from "./markdown";

function getDb() {
  const db = getDbInstance();
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

const OWNER = process.env.GITHUB_OWNER || "jon889";
const REPO = process.env.GITHUB_REPO || "fos-study";
const BRANCH = process.env.GITHUB_BRANCH || "main";

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

// ===== GitHub API helpers =====

async function getCurrentHeadSha(): Promise<string> {
  const response = await octokit.repos.getBranch({
    owner: OWNER,
    repo: REPO,
    branch: BRANCH,
  });
  return response.data.commit.sha;
}

interface ChangedFile {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed" | "copied" | "changed" | "unchanged";
  previous_filename?: string;
}

/**
 * baseSha..headSha 사이의 변경 파일 목록 반환.
 * 변경 파일이 300개 이상이면 null을 반환 → full sync 폴백.
 */
async function getChangedFilesSince(
  baseSha: string,
  headSha: string
): Promise<ChangedFile[] | null> {
  try {
    const response = await octokit.repos.compareCommitsWithBasehead({
      owner: OWNER,
      repo: REPO,
      basehead: `${baseSha}...${headSha}`,
    });

    if (!response.data.files || response.data.files.length >= 300) {
      console.log("변경 파일이 300개 이상이거나 없음 → full sync 폴백");
      return null;
    }

    return response.data.files.map((f) => ({
      filename: f.filename,
      status: f.status as ChangedFile["status"],
      previous_filename: f.previous_filename,
    }));
  } catch (error) {
    console.error("Compare API 오류 → full sync 폴백:", error);
    return null;
  }
}

async function getLastSyncedCommitSha(): Promise<string | null> {
  const database = getDb();
  const result = await database
    .select({ commitSha: syncLogs.commitSha })
    .from(syncLogs)
    .where(eq(syncLogs.status, "success"))
    .orderBy(desc(syncLogs.syncedAt))
    .limit(1);
  return result[0]?.commitSha ?? null;
}

/**
 * GitHub 커밋 히스토리에서 파일의 최초 작성일(createdAt)과 최신 수정일(updatedAt)을 가져옴
 * per_page=100으로 최대 100개 커밋 조회 (배열 앞 = 최신, 뒤 = 오래된 순)
 */
async function getFileCommitDates(
  filePath: string
): Promise<{ createdAt: Date; updatedAt: Date } | null> {
  try {
    const response = await octokit.repos.listCommits({
      owner: OWNER,
      repo: REPO,
      path: filePath,
      per_page: 100,
    });

    const commits = response.data;
    if (commits.length === 0) return null;

    const latestCommit = commits[0];
    const firstCommit = commits[commits.length - 1];

    const updatedAt = new Date(
      latestCommit.commit.committer?.date ??
        latestCommit.commit.author?.date ??
        new Date()
    );
    const createdAt = new Date(
      firstCommit.commit.committer?.date ??
        firstCommit.commit.author?.date ??
        updatedAt
    );

    return { createdAt, updatedAt };
  } catch (error) {
    console.warn(`커밋 날짜 조회 실패 (${filePath}):`, error);
    return null;
  }
}

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
      const content = Buffer.from(response.data.content, "base64").toString("utf-8");
      return { content, sha: response.data.sha };
    }
    return null;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "status" in error && error.status === 404) {
      return null;
    }
    console.error(`파일 내용 가져오기 실패 ${path}:`, error);
    return null;
  }
}

async function getDirectoryContents(path: string = "") {
  try {
    const response = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path });
    if (Array.isArray(response.data)) return response.data;
    return [];
  } catch (error) {
    console.error(`디렉토리 내용 가져오기 실패 ${path}:`, error);
    return [];
  }
}

// ===== File processing helpers =====

function parsePath(filePath: string) {
  const pathParts = filePath.split("/");
  const category = pathParts[0] || "uncategorized";
  const foldersList = pathParts.slice(1, -1);
  const subcategory = foldersList.length > 0 ? foldersList[0] : undefined;
  const title = pathParts[pathParts.length - 1]
    .replace(/\.(md|mdx)$/, "")
    .replace(/_/g, " ");
  return { category, foldersList, subcategory, title };
}

// AI 에이전트 컨텍스트 파일 — 블로그 포스트로 동기화하지 않음
const EXCLUDED_FILENAMES = new Set([
  "AGENTS.MD",
  "CLAUDE.MD",
  "GEMINI.MD",
  "COPILOT.MD",
  "CURSOR.MD",
  "CODERABBIT.MD",
  "CODY.MD",
]);

function isMdFile(filename: string) {
  const basename = (filename.split("/").pop() ?? "").toUpperCase();
  if (EXCLUDED_FILENAMES.has(basename)) return false;
  return filename.endsWith(".md") || filename.endsWith(".mdx");
}

async function upsertPost(filePath: string): Promise<"added" | "updated" | "skipped"> {
  const database = getDb();
  const [fileData, commitDates] = await Promise.all([
    getFileContent(filePath),
    getFileCommitDates(filePath),
  ]);
  if (!fileData) return "skipped";

  const { category, foldersList, subcategory, title: filenameTitle } = parsePath(filePath);
  const title = extractTitle(fileData.content) || filenameTitle;
  const description = extractDescription(fileData.content, 200);

  const existing = await database
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.path, filePath))
    .limit(1);

  if (existing.length > 0) {
    await database
      .update(posts)
      .set({
        title,
        content: fileData.content,
        description,
        sha: fileData.sha,
        category,
        subcategory,
        folders: foldersList,
        isActive: true,
        updatedAt: commitDates?.updatedAt ?? new Date(),
      })
      .where(eq(posts.id, existing[0].id));
    return "updated";
  } else {
    await database.insert(posts).values({
      title,
      path: filePath,
      slug: filePath,
      category,
      subcategory,
      folders: foldersList,
      content: fileData.content,
      description,
      sha: fileData.sha,
      ...(commitDates && {
        createdAt: commitDates.createdAt,
        updatedAt: commitDates.updatedAt,
      }),
    });
    return "added";
  }
}

async function deactivatePost(filePath: string): Promise<boolean> {
  const database = getDb();
  const result = await database
    .update(posts)
    .set({ isActive: false })
    .where(eq(posts.path, filePath));
  return (result[0] as { affectedRows?: number }).affectedRows === 1;
}

// ===== Sync strategies =====

async function performIncrementalSync(changedFiles: ChangedFile[]): Promise<{
  added: number;
  updated: number;
  deleted: number;
}> {
  let added = 0, updated = 0, deleted = 0;

  for (const file of changedFiles) {
    if (file.status === "removed") {
      if (isMdFile(file.filename)) {
        const ok = await deactivatePost(file.filename);
        if (ok) deleted++;
        console.log(`삭제: ${file.filename}`);
      }
    } else if (file.status === "renamed") {
      // 이전 경로 비활성화
      if (file.previous_filename && isMdFile(file.previous_filename)) {
        const ok = await deactivatePost(file.previous_filename);
        if (ok) deleted++;
        console.log(`이름 변경(삭제): ${file.previous_filename}`);
      }
      // 새 경로 upsert
      if (isMdFile(file.filename)) {
        const result = await upsertPost(file.filename);
        if (result === "added") added++;
        else if (result === "updated") updated++;
        console.log(`이름 변경(추가): ${file.filename} → ${result}`);
      }
    } else {
      // added | modified | copied | changed
      if (isMdFile(file.filename)) {
        const result = await upsertPost(file.filename);
        if (result === "added") added++;
        else if (result === "updated") updated++;
        console.log(`${file.status}: ${file.filename} → ${result}`);
      }
    }
  }

  return { added, updated, deleted };
}

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
    } else if (item.type === "file" && isMdFile(item.name)) {
      const { category, foldersList, subcategory } = parsePath(item.path);
      files.push({
        name: item.name,
        path: item.path,
        sha: item.sha,
        category,
        subcategory,
        folders: foldersList,
      });
    }
  }
  return files;
}

async function performFullSync(): Promise<{
  added: number;
  updated: number;
  deleted: number;
}> {
  const database = getDb();
  let added = 0, updated = 0, deleted = 0;

  const githubFiles = await collectMarkdownFiles();
  console.log(`GitHub에서 마크다운 파일 ${githubFiles.length}개 발견`);

  const existingPosts = await database.select().from(posts);
  const existingPathMap = new Map(existingPosts.map((p) => [p.path, p]));
  const processedPaths = new Set<string>();

  for (const file of githubFiles) {
    processedPaths.add(file.path);
    const existing = existingPathMap.get(file.path);

    if (existing && existing.sha === file.sha) continue;

    const [fileData, commitDates] = await Promise.all([
      getFileContent(file.path),
      getFileCommitDates(file.path),
    ]);
    if (!fileData) continue;

    const { title: filenameTitle } = parsePath(file.path);
    const title = extractTitle(fileData.content) || filenameTitle;
    const description = extractDescription(fileData.content, 200);

    if (existing) {
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
          isActive: true,
          updatedAt: commitDates?.updatedAt ?? new Date(),
        })
        .where(eq(posts.id, existing.id));
      updated++;
      console.log(`업데이트: ${file.path}`);
    } else {
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
        ...(commitDates && {
          createdAt: commitDates.createdAt,
          updatedAt: commitDates.updatedAt,
        }),
      });
      added++;
      console.log(`추가: ${file.path}`);
    }
  }

  for (const existing of existingPosts) {
    if (!processedPaths.has(existing.path) && existing.isActive) {
      await database
        .update(posts)
        .set({ isActive: false })
        .where(eq(posts.id, existing.id));
      deleted++;
      console.log(`비활성화: ${existing.path}`);
    }
  }

  return { added, updated, deleted };
}

// ===== Category & README sync =====

async function updateCategories(): Promise<void> {
  const database = getDb();
  const categoryStats = await database
    .select({
      category: posts.category,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(posts)
    .where(eq(posts.isActive, true))
    .groupBy(posts.category);

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

async function syncFolderReadmes(): Promise<void> {
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

// ===== Main export =====

export async function syncGitHubToDatabase(): Promise<{
  added: number;
  updated: number;
  deleted: number;
  commitSha: string;
  upToDate?: boolean;
}> {
  console.log("GitHub → Database 동기화 시작...");
  const database = getDb();

  let added = 0, updated = 0, deleted = 0;

  try {
    const headSha = await getCurrentHeadSha();
    const lastSyncedSha = await getLastSyncedCommitSha();

    console.log(`현재 HEAD: ${headSha.slice(0, 7)}`);
    console.log(`마지막 sync: ${lastSyncedSha ? lastSyncedSha.slice(0, 7) : "없음 (최초 sync)"}`);

    if (lastSyncedSha === headSha) {
      console.log("이미 최신 상태입니다.");
      return { added: 0, updated: 0, deleted: 0, commitSha: headSha, upToDate: true };
    }

    if (!lastSyncedSha) {
      console.log("최초 sync — 전체 동기화 수행");
      ({ added, updated, deleted } = await performFullSync());
    } else {
      const changedFiles = await getChangedFilesSince(lastSyncedSha, headSha);
      if (changedFiles === null) {
        console.log("전체 동기화 폴백 수행");
        ({ added, updated, deleted } = await performFullSync());
      } else {
        console.log(`변경 파일 ${changedFiles.length}개에 대해 증분 동기화 수행`);
        ({ added, updated, deleted } = await performIncrementalSync(changedFiles));
      }
    }

    await updateCategories();
    await syncFolderReadmes();

    await database.insert(syncLogs).values({
      status: "success",
      postsAdded: added,
      postsUpdated: updated,
      postsDeleted: deleted,
      commitSha: headSha,
    });

    console.log(
      `동기화 완료: ${added}개 추가, ${updated}개 업데이트, ${deleted}개 삭제 (commit: ${headSha.slice(0, 7)})`
    );
    return { added, updated, deleted, commitSha: headSha };
  } catch (error) {
    console.error("동기화 실패:", error);
    await database.insert(syncLogs).values({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// DB에 저장된 content에서 h1 제목을 재추출하여 title 일괄 업데이트
// GitHub API 호출 없이 로컬 DB만 사용
export async function retitleExistingPosts(): Promise<{
  total: number;
  updated: number;
  skipped: number;
}> {
  const database = getDb();

  const allPosts = await database
    .select({ path: posts.path, title: posts.title, content: posts.content })
    .from(posts);

  let updated = 0;
  let skipped = 0;

  for (const post of allPosts) {
    if (!post.content) { skipped++; continue; }

    const extractedTitle = extractTitle(post.content);
    if (!extractedTitle || extractedTitle === post.title) { skipped++; continue; }

    await database
      .update(posts)
      .set({ title: extractedTitle })
      .where(eq(posts.path, post.path));

    updated++;
    console.log(`제목 업데이트: ${post.path} → ${extractedTitle}`);
  }

  return { total: allPosts.length, updated, skipped };
}
