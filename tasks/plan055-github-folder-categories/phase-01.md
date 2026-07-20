# Phase 01 — GitHub HEAD 폴더 기반 category 검증

**Execution profile**: standard
**Status**: pending

---

## 목표

frontmatter `categories`를 동기화 대상 GitHub HEAD의 실제 폴더와 대조한다.
전체·증분 동기화가 같은 폴더 스냅샷을 사용하며, 검증할 수 없거나 값이 잘못되어도 글 저장은 중단하지 않는다.

**범위 외**: 신규 카테고리 표시명·색상·아이콘, DB schema, `/api/sync` 응답 변경, 동시 동기화 잠금.

---

## 작업 항목 (4)

### 1. `src/infra/github/api.ts` — commit 기준 폴더 스냅샷

다음 함수를 추가하고 기존 `withRetry()`와 Octokit client를 재사용한다.

```ts
export async function getRepositoryFolderPaths(
  commitSha: string,
): Promise<ReadonlySet<string> | null>
```

`octokit.git.getCommit()`으로 commit의 root tree SHA를 얻고 `octokit.git.getTree({ recursive: "1" })`에서 `type === "tree"`인 저장소 상대 경로를 수집한다.
경로는 선행·후행 slash 없이 GitHub가 반환한 대소문자를 보존한다.

recursive 응답의 `truncated`가 `true`이면 root tree부터 비재귀 조회하며 각 하위 tree SHA를 순회해 완전한 경로 집합을 만든다.
비재귀 응답도 잘렸거나 필수 SHA·path가 없어 완전성을 보장할 수 없으면 `null`을 반환한다.
빈 repository tree는 빈 `Set`이며, API 오류와 불완전한 tree는 검증 생략 원인을 한 번 기록한 뒤 `null`로 구분한다.

### 2. `PostSyncService` — 요청 단위 검증 문맥

`GithubApi` 구조적 타입에 `getRepositoryFolderPaths`를 추가하고 공개 계약을 다음처럼 확장한다.

```ts
syncAll(headSha: string): Promise<PostSyncResult>
syncChanged(changedFiles: ChangedFile[], headSha: string): Promise<PostSyncResult>
```

각 호출은 폴더 스냅샷을 한 번만 읽어 모든 upsert에 전달한다.
`upsert()`와 parsing 경로를 full·incremental에서 계속 공유하며 별도 category 저장 경로를 만들지 않는다.

### 3. frontmatter category 경고 계약

`warnUnknownFrontMatterCategories()`에 `ReadonlySet<string> | null` 폴더 인자를 추가한다.
trim과 빈 문자열 제거 후 현재 글의 path category를 제외하고 다음 중 하나면 허용한다.

- 폴더 집합의 경로와 대소문자까지 정확히 일치한다.
- `isKnownCategoryKey()`가 선택적 정적 meta로 인정한다.

둘 다 아니면 중복을 제거한 category 목록을 한 번의 `warn`에 기록한다.
폴더 인자가 `null`이면 잘못된 개별 경고를 피하기 위해 검증을 생략한다.
경고 유무와 관계없이 `mergeCategories()`와 repository create·update를 실행한다.

### 4. `SyncService` wiring과 회귀 테스트

`SyncService.syncPosts()`가 full·incremental 양쪽에서 현재 `headSha`를 `PostSyncService`에 전달하게 한다.
`SyncService`가 GitHub tree를 직접 조회하거나 category 판정을 맡지 않게 한다.
`src/services/index.ts`의 구조적 Github API wiring과 테스트 mock을 새 함수에 맞춘다.

다음을 자동 테스트한다.

- full·incremental 모두 현재 HEAD를 전달한다.
- 실제 최상위·하위 폴더는 경고하지 않는다.
- 정적 meta만 있는 legacy key도 경고하지 않는다.
- 둘 다 없는 key는 경고하지만 create·update된다.
- 대소문자가 다른 실제 경로는 경고한다.
- 폴더 조회 실패는 개별 category 경고 없이 저장한다.
- recursive tree 잘림은 하위 조회로 완성하고, 완성할 수 없으면 `null`을 반환한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/infra/github/api.ts` | commit 기준 폴더 tree 조회 |
| `src/infra/github/api.test.ts` | tree 정상·잘림·실패 테스트 |
| `src/services/PostSyncService.ts` | 폴더 스냅샷과 경고 기준 |
| `src/services/PostSyncService.test.ts` | full·incremental 저장·경고 회귀 |
| `src/services/SyncService.ts` | `headSha` 전달 |
| `src/services/SyncService.test.ts` | 전체·증분 전달 계약 |
| `src/services/index.ts` | Github API wiring |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog/.claude/worktrees/plan055-github-folder-categories
# branch: feat/plan055-github-folder-categories
pnpm test src/infra/github/api.test.ts src/services/PostSyncService.test.ts src/services/SyncService.test.ts
pnpm type-check
rg -n "getRepositoryFolderPaths" src/infra/github/api.ts src/services/PostSyncService.ts
rg -n "new PostSyncService\(postRepo, githubApi\)" src/services/index.ts
```

기대값:

- 테스트와 type-check exit code가 0이다.
- 두 `rg`가 함수 정의와 `PostSyncService` 참조, 기존 `githubApi` 구조적 주입을 출력한다.
- `/api/sync` 응답 타입과 DB schema에는 diff가 없다.

## 의도 메모 (왜)

- 증분 변경 파일만으로는 변경되지 않은 폴더를 알 수 없으므로 해당 HEAD의 완전한 tree를 기준으로 삼는다.
- `SyncService`는 HEAD와 실행 순서만 조정하고 category 검증은 글 parsing을 소유한 `PostSyncService`에 둔다.
- plan054의 `refactor(sync): split post and metadata responsibilities`가 최종 구조다.
  이번 phase는 분리된 책임을 되돌리지 않고 `PostSyncService`의 기존 full·incremental 공통 upsert 경로를 확장한다.
- category 검증은 저자에게 오타를 알려주는 진단이며 콘텐츠 가용성을 차단하는 제약이 아니다.
- full sync의 Markdown 파일 탐색은 기존 Contents API 경로를 유지해 issue #182 밖의 변경을 만들지 않는다.
