/**
 * 마크다운의 상대/절대경로 .md 링크를 블로그 URL로 변환
 *
 * 지원하는 링크 형식:
 * - 절대경로: /java/spring-batch/post.md → /posts/java/spring-batch/post
 * - 상대경로: ./other.md, ../category/post.md → /posts/...
 * - 앵커 포함: post.md#section → /posts/.../post#section
 *
 * @param href 마크다운 링크의 href 값
 * @param basePath 현재 파일의 경로 (예: "java/spring-batch/README" 또는 "AI/RAG/embedding")
 */
export function resolveMarkdownLink(href: string, basePath: string): string {
  const hashIdx = href.indexOf("#");
  const fragment = hashIdx !== -1 ? href.slice(hashIdx) : "";
  const linkPath = hashIdx !== -1 ? href.slice(0, hashIdx) : href;

  const pathWithoutExt = linkPath.replace(/\.mdx?$/, "");

  // /로 시작하는 절대경로 (repo root 기준) → /posts/ 앞에 붙이기
  if (pathWithoutExt.startsWith("/")) {
    return `/posts${pathWithoutExt}${fragment}`;
  }

  // 상대경로: basePath의 디렉토리 기준으로 해석
  const baseSegments = basePath.split("/").slice(0, -1);
  const resolved = [...baseSegments];

  for (const seg of pathWithoutExt.split("/")) {
    if (seg === ".") continue;
    else if (seg === "..") resolved.pop();
    else resolved.push(seg);
  }

  return `/posts/${resolved.join("/")}${fragment}`;
}
