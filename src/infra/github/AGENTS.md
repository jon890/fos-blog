<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-01 | Updated: 2026-04-01 -->

# infra/github

## Purpose

GitHub API 통합 레이어. Octokit 클라이언트 초기화, API 함수, 파일 필터링, 이미지 경로 재작성을 담당한다. `src/services/`에서 사용된다.

## Key Files

| File               | Description                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `client.ts`        | Octokit 클라이언트 초기화 — `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` 환경변수 사용   |
| `api.ts`           | GitHub API 함수 — 리포 트리 조회, 파일 내용 조회, HEAD SHA 비교                           |
| `file-filter.ts`   | 파일 필터링 — `.md` 확장자 확인, 제외 패턴 적용 (`shouldSyncFile()`)                      |
| `image-rewrite.ts` | 이미지 경로 재작성 — 마크다운 내 상대경로를 GitHub raw URL로 변환 (`rewriteImagePaths()`) |

## For AI Agents

### Working In This Directory

- `client.ts`는 싱글턴 패턴으로 Octokit 인스턴스를 export한다
- `api.ts`의 함수들은 순수 API 호출만 수행한다 — DB 쓰기 없음
- `image-rewrite.ts`의 `rewriteImagePaths(content, filePath)`는 content를 DB에 저장하기 **전에** 반드시 호출해야 한다
- GitHub API 요청 제한: 인증 시 5000req/hr, 미인증 시 60req/hr

### Key Exports

```ts
// client.ts
export const octokit: Octokit;
export const OWNER: string;
export const REPO: string;

// api.ts
getRepoTree(sha?: string): Promise<TreeItem[]>
getFileContent(path: string): Promise<string>
getHeadSha(): Promise<string>

// file-filter.ts
shouldSyncFile(filename: string): boolean

// image-rewrite.ts
rewriteImagePaths(content: string, filePath: string): string
```

## Dependencies

### External

- `@octokit/rest` — GitHub REST API 클라이언트
