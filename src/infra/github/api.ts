import { octokit, OWNER, REPO, BRANCH } from "./client";
import logger from "@/lib/logger";

const log = logger.child({ module: "infra/github/api" });

const VALID_STATUSES = new Set<string>([
  "added",
  "modified",
  "removed",
  "renamed",
  "copied",
  "changed",
  "unchanged",
]);

export interface ChangedFile {
  filename: string;
  status:
    | "added"
    | "modified"
    | "removed"
    | "renamed"
    | "copied"
    | "changed"
    | "unchanged";
  previous_filename?: string;
}

export async function getCurrentHeadSha(): Promise<string> {
  const response = await octokit.repos.getBranch({
    owner: OWNER,
    repo: REPO,
    branch: BRANCH,
  });
  return response.data.commit.sha;
}

/**
 * baseSha..headSha 사이의 변경 파일 목록 반환.
 * 변경 파일이 300개 이상이면 null을 반환 → full sync 폴백.
 */
export async function getChangedFilesSince(
  baseSha: string,
  headSha: string,
): Promise<ChangedFile[] | null> {
  try {
    const response = await octokit.repos.compareCommitsWithBasehead({
      owner: OWNER,
      repo: REPO,
      basehead: `${baseSha}...${headSha}`,
    });

    if (!response.data.files || response.data.files.length >= 300) {
      log.info("변경 파일이 300개 이상이거나 없음 → full sync 폴백");
      return null;
    }

    return response.data.files
      .filter((f) => VALID_STATUSES.has(f.status))
      .map((f) => ({
        filename: f.filename,
        status: f.status as ChangedFile["status"],
        previous_filename: f.previous_filename,
      }));
  } catch (error) {
    log.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      "Compare API 오류 → full sync 폴백",
    );
    return null;
  }
}

/**
 * GitHub 커밋 히스토리에서 파일의 최초 작성일(createdAt)과 최신 수정일(updatedAt)을 가져옴
 * per_page=100으로 최대 100개 커밋 조회 (배열 앞 = 최신, 뒤 = 오래된 순)
 */
export async function getFileCommitDates(
  filePath: string,
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
        new Date(),
    );
    const createdAt = new Date(
      firstCommit.commit.committer?.date ??
        firstCommit.commit.author?.date ??
        updatedAt,
    );

    return { createdAt, updatedAt };
  } catch (error) {
    log.error(
      {
        err: error instanceof Error ? error : new Error(String(error)),
        filePath,
      },
      "커밋 날짜 조회 실패",
    );
    return null;
  }
}

export async function getFileContent(
  path: string,
): Promise<{ content: string; sha: string } | null> {
  try {
    const response = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path,
    });
    if (!Array.isArray(response.data) && response.data.type === "file") {
      const content = Buffer.from(response.data.content, "base64").toString(
        "utf-8",
      );
      return { content, sha: response.data.sha };
    }
    return null;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
    ) {
      return null;
    }
    log.error(
      { err: error instanceof Error ? error : new Error(String(error)), path },
      "파일 내용 가져오기 실패",
    );
    return null;
  }
}

export async function getDirectoryContents(path: string = "") {
  try {
    const response = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path,
    });
    if (Array.isArray(response.data)) return response.data;
    return [];
  } catch (error) {
    log.error(
      { err: error instanceof Error ? error : new Error(String(error)), path },
      "디렉토리 내용 가져오기 실패",
    );
    return [];
  }
}
