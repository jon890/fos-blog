import { OWNER, REPO, BRANCH } from "./client";

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
