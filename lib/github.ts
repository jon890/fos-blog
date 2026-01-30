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
      const content = Buffer.from(
        response.data.content,
        "base64"
      ).toString("utf-8");
      return content;
    }
    return "";
  } catch (error) {
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
      const subcategory = pathParts.length > 2 ? pathParts[1] : undefined;

      files.push({
        title: item.name.replace(/\.(md|mdx)$/, "").replace(/_/g, " "),
        path: item.path,
        slug: item.path, // Keep original path, encode when needed in URLs
        category,
        subcategory,
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

    return {
      content,
      post: {
        title: fileName.replace(/\.(md|mdx)$/, "").replace(/_/g, " "),
        path,
        slug,
        category,
        subcategory: pathParts.length > 2 ? pathParts[1] : undefined,
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
