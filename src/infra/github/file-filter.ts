// AI 에이전트 컨텍스트 파일 — 블로그 포스트로 동기화하지 않음
export const EXCLUDED_FILENAMES = new Set([
  "AGENTS.MD",
  "CLAUDE.MD",
  "GEMINI.MD",
  "COPILOT.MD",
  "CURSOR.MD",
  "CODERABBIT.MD",
  "CODY.MD",
  "README.MD",
]);

/**
 * 주어진 파일 경로가 동기화 대상인지 판단한다.
 * - .md / .mdx 확장자여야 함
 * - 경로의 어느 세그먼트도 "."으로 시작하지 않아야 함 (.claude/, .gemini/ 등 제외)
 * - AI 에이전트 컨텍스트 파일(AGENTS.MD, CLAUDE.MD 등)이 아니어야 함
 */
export function shouldSyncFile(filename: string): boolean {
  if (!filename.endsWith(".md") && !filename.endsWith(".mdx")) return false;
  const parts = filename.split("/");
  if (parts.some((p) => p.startsWith("."))) return false;
  const basename = (parts[parts.length - 1] ?? "").toUpperCase();
  if (EXCLUDED_FILENAMES.has(basename)) return false;
  return true;
}

