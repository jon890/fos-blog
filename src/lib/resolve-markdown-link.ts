/**
 * 마크다운의 상대/절대경로 .md 링크를 블로그 URL로 변환
 *
 * 라우팅 규약:
 * - 일반 글: /java/post.md → /posts/java/post.md (.md 유지)
 * - README: README 는 글이 아니라 /category 폴더 페이지로 렌더되므로
 *   (src/app/category/[...path]/page.tsx) 마지막 세그먼트를 떼고 /category/<폴더> 로 보낸다.
 *   본문에 직접 쓴 README 링크가 /posts/.../README.md 로 가서 404 나는 것을 막는다 (이슈 #178).
 * - 최상위 README (폴더가 빈 문자열) → /categories (카테고리 목록). /category/ 빈 경로는 404 이므로 방어.
 * - 앵커(#...)는 그대로 보존.
 *
 * @param href 마크다운 링크의 href 값
 * @param basePath 현재 파일의 경로 (예: "java/spring-batch/README.md")
 */
export function resolveMarkdownLink(href: string, basePath: string): string {
  const hashIdx = href.indexOf("#");
  const fragment = hashIdx !== -1 ? href.slice(hashIdx) : "";
  const linkPath = hashIdx !== -1 ? href.slice(0, hashIdx) : href;

  let resolved: string[];
  if (linkPath.startsWith("/")) {
    // 절대경로 (repo root 기준)
    resolved = linkPath.split("/").filter(Boolean);
  } else {
    // 상대경로: basePath 의 디렉토리 기준으로 해석
    resolved = basePath.split("/").slice(0, -1);
    for (const seg of linkPath.split("/")) {
      if (seg === ".") continue;
      else if (seg === "..") resolved.pop();
      else if (seg !== "") resolved.push(seg);
    }
  }

  const last = resolved[resolved.length - 1];
  if (last && /^README(\.mdx?)?$/i.test(last)) {
    const folder = resolved.slice(0, -1).join("/");
    // 최상위 README → 폴더 없음 → 카테고리 목록으로 방어 (/category/ 빈 경로는 404)
    return folder ? `/category/${folder}${fragment}` : `/categories${fragment}`;
  }

  return `/posts/${resolved.join("/")}${fragment}`;
}
