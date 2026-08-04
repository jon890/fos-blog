import { OWNER, REPO, BRANCH } from "./client";

const THUMBNAIL_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);

function getMarkdownDir(filePath: string): string[] {
  return filePath.split("/").slice(0, -1).filter(Boolean);
}

function toRawUrl(repoPathSegments: string[]): string {
  const encodedPath = repoPathSegments.map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${encodedPath}`;
}

/**
 * 마크다운 content 내 상대경로 이미지를 GitHub raw URL로 변환한다.
 * ./images/foo.png → https://raw.githubusercontent.com/OWNER/REPO/BRANCH/dir/images/foo.png
 */
export function rewriteImagePaths(content: string, filePath: string): string {
  const dir = filePath.split("/").slice(0, -1).join("/");
  const baseUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}`;

  const resolve = (relativePath: string): string => {
    const parts = dir ? dir.split("/") : [];
    for (const part of relativePath.split("/")) {
      if (part === ".." && parts.length > 0) parts.pop();
      else if (part !== ".") parts.push(part);
    }
    return `${baseUrl}/${parts.join("/")}`;
  };

  // ![alt](relative/path)
  let result = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    if (src.startsWith("http://") || src.startsWith("https://")) return match;
    return `![${alt}](${resolve(src)})`;
  });

  // <img src="relative/path">
  result = result.replace(/<img([^>]+)src="([^"]+)"/g, (match, _attrs, src) => {
    if (src.startsWith("http://") || src.startsWith("https://")) return match;
    return `<img src="${resolve(src)}"`;
  });

  return result;
}

export function resolveThumbnailUrl(
  thumbnailPath: string | undefined,
  filePath: string,
): string | null {
  const value = thumbnailPath?.trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return null;
  if (value.startsWith("/")) return null;
  if (value.includes("?") || value.includes("#")) return null;
  if (value.includes("\\")) return null;

  const segments = getMarkdownDir(filePath);
  for (const segment of value.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  const filename = segments.at(-1);
  if (!filename) return null;
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) return null;
  const extension = filename.slice(dotIndex).toLowerCase();
  if (!THUMBNAIL_EXTENSIONS.has(extension)) return null;

  return toRawUrl(segments);
}
