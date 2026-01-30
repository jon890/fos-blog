import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const OWNER = process.env.GITHUB_OWNER || "jon890";
const REPO = process.env.GITHUB_REPO || "fos-study";

export interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  sha: string;
  url: string;
  download_url?: string;
}

export interface Post {
  title: string;
  path: string;
  slug: string;
  category: string;
  subcategory?: string;
  /** 전체 폴더 경로 (카테고리 제외) - n-depth 지원 */
  folders: string[];
  lastModified?: string;
}

export interface Category {
  name: string;
  slug: string;
  count: number;
  icon?: string;
}

// Category icons mapping
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

// Get directory contents from GitHub
export async function getDirectoryContents(
  path: string = ""
): Promise<GitHubFile[]> {
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

// Get file content from GitHub
export async function getFileContent(path: string): Promise<string> {
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
      return content;
    }
    return "";
  } catch (error: unknown) {
    // 404 에러는 파일이 없는 경우로 조용히 처리
    if (error && typeof error === "object" && "status" in error && error.status === 404) {
      return "";
    }
    console.error(`Error fetching file content for ${path}:`, error);
    return "";
  }
}

// Get all markdown files recursively
export async function getAllMarkdownFiles(
  path: string = "",
  files: Post[] = []
): Promise<Post[]> {
  const contents = await getDirectoryContents(path);

  for (const item of contents) {
    // Skip hidden files and directories
    if (item.name.startsWith(".")) continue;

    if (item.type === "dir") {
      await getAllMarkdownFiles(item.path, files);
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
        title: item.name.replace(/\.(md|mdx)$/, "").replace(/_/g, " "),
        path: item.path,
        slug: item.path, // Keep original path, encode when needed in URLs
        category,
        subcategory,
        folders,
      });
    }
  }

  return files;
}

// Get categories from repository
export async function getCategories(): Promise<Category[]> {
  const contents = await getDirectoryContents();
  const categories: Category[] = [];

  for (const item of contents) {
    if (
      item.type === "dir" &&
      !item.name.startsWith(".") &&
      item.name !== "node_modules"
    ) {
      const files = await getAllMarkdownFiles(item.path, []);
      if (files.length > 0) {
        categories.push({
          name: item.name,
          slug: item.name, // Keep original name, encode when needed in URLs
          count: files.length,
          icon: categoryIcons[item.name] || "📁",
        });
      }
    }
  }

  return categories.sort((a, b) => b.count - a.count);
}

// Get posts by category
export async function getPostsByCategory(category: string): Promise<Post[]> {
  const files = await getAllMarkdownFiles(category, []);
  return files;
}

export interface FolderItem {
  name: string;
  type: "folder" | "file";
  path: string;
  count?: number; // 폴더 내 파일 수
  post?: Post; // 파일인 경우 Post 정보
}

// Get README content from a folder
export async function getFolderReadme(
  folderPath: string
): Promise<string | null> {
  const readmeNames = ["README.md", "readme.md", "README.MD", "Readme.md"];

  for (const readmeName of readmeNames) {
    const readmePath = folderPath ? `${folderPath}/${readmeName}` : readmeName;
    const content = await getFileContent(readmePath);
    if (content) {
      return content;
    }
  }

  return null;
}

// Get folder contents at a specific path (folders + files)
export async function getFolderContents(
  folderPath: string
): Promise<{ folders: FolderItem[]; posts: Post[]; readme: string | null }> {
  const contents = await getDirectoryContents(folderPath);
  const folders: FolderItem[] = [];
  const posts: Post[] = [];
  const pathParts = folderPath.split("/").filter(Boolean);
  const category = pathParts[0] || "uncategorized";

  for (const item of contents) {
    if (item.name.startsWith(".")) continue;

    if (item.type === "dir") {
      // 해당 폴더 내 마크다운 파일 수 계산
      const filesInFolder = await getAllMarkdownFiles(item.path, []);
      folders.push({
        name: item.name,
        type: "folder",
        path: item.path,
        count: filesInFolder.length,
      });
    } else if (
      item.type === "file" &&
      (item.name.endsWith(".md") || item.name.endsWith(".mdx"))
    ) {
      const itemPathParts = item.path.split("/");
      const itemFolders = itemPathParts.slice(1, -1);

      posts.push({
        title: item.name.replace(/\.(md|mdx)$/, "").replace(/_/g, " "),
        path: item.path,
        slug: item.path,
        category,
        subcategory: itemFolders.length > 0 ? itemFolders[0] : undefined,
        folders: itemFolders,
      });
    }
  }

  // README 내용 가져오기
  const readme = await getFolderReadme(folderPath);

  return {
    folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
    posts: posts.sort((a, b) => a.title.localeCompare(b.title)),
    readme,
  };
}

// Get all folder paths for static generation
export async function getAllFolderPaths(
  basePath: string = "",
  paths: string[][] = []
): Promise<string[][]> {
  const contents = await getDirectoryContents(basePath);

  for (const item of contents) {
    if (item.name.startsWith(".") || item.name === "node_modules") continue;

    if (item.type === "dir") {
      const pathSegments = item.path.split("/");
      paths.push(pathSegments);
      await getAllFolderPaths(item.path, paths);
    }
  }

  return paths;
}

// Get single post content
export async function getPost(
  slug: string
): Promise<{ content: string; post: Post } | null> {
  try {
    const path = slug;
    const content = await getFileContent(path);

    if (!content) return null;

    const pathParts = path.split("/");
    const category = pathParts[0] || "uncategorized";
    const fileName = pathParts[pathParts.length - 1];

    const folders = pathParts.slice(1, -1);

    return {
      content,
      post: {
        title: fileName.replace(/\.(md|mdx)$/, "").replace(/_/g, " "),
        path,
        slug,
        category,
        subcategory: folders.length > 0 ? folders[0] : undefined,
        folders,
      },
    };
  } catch (error) {
    console.error(`Error fetching post ${slug}:`, error);
    return null;
  }
}

// Get recent posts
export async function getRecentPosts(limit: number = 10): Promise<Post[]> {
  const allFiles = await getAllMarkdownFiles();
  // Return the most recent files (in this case, we'll just take the last N)
  return allFiles.slice(0, limit);
}

// Get category icon
export function getCategoryIcon(category: string): string {
  return categoryIcons[category] || "📁";
}

// Get category color class
export function getCategoryColorClass(category: string): string {
  const colorMap: Record<string, string> = {
    AI: "category-ai",
    algorithm: "category-algorithm",
    architecture: "category-architecture",
    database: "category-database",
    devops: "category-devops",
    java: "category-java",
    javascript: "category-javascript",
    react: "category-react",
  };

  return colorMap[category.toLowerCase()] || "category-default";
}
