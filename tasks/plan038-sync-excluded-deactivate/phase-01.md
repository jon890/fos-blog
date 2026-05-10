# Phase 01 — incremental EXCLUDED deactivate 가드 제거 + 백필 migration

**Model**: sonnet
**Goal**: GitHub 에서 삭제된 EXCLUDED 파일 (README.md 등) 이 incremental sync 분기에서도 deactivate 되도록 가드 제거. 과거 EXCLUDED 정책 추가 전 sync 됐던 잔존 row 를 Drizzle migration SQL 로 일괄 정리.

## Context (자기완결)

`src/services/SyncService.ts` 의 `performIncrementalSync` 가 `removed` / `renamed` 분기에서 `shouldSyncFile(file.filename)` 체크 후에만 `postRepo.deactive` 를 호출한다. `shouldSyncFile` 은 `EXCLUDED_FILENAMES` (README.MD / AGENTS.MD / CLAUDE.MD 등) 인 경우 `false` 를 반환하므로, fos-study 에서 README 등 EXCLUDED 파일이 삭제되어도 fos-blog DB 의 row 는 deactivate 되지 않는다.

`performFullSync` 는 이 버그가 없다 — `processedPaths` 에 EXCLUDED 가 들어가지 않아 `existingPosts.filter((p) => !processedPaths.has(p.path) && p.isActive)` 가 잡아서 `deactivateByIds` 호출. 하지만 평상 운영에서 incremental 만 도는 한 EXCLUDED 잔존이 영구화된다.

**관측 사례** (2026-05-09): `posts.id=17, path="css/FlexBox/README.md"` 가 fos-study 에서 css 폴더 통째 삭제 후에도 `is_active=1` 로 잔존. plan037 의 self-heal (categories drift) 은 categories 만 정리하고 posts 는 안 닿음.

**플젝 컨벤션**:
- `EXCLUDED_FILENAMES` 단일 소스: `src/infra/github/file-filter.ts:2` (대문자)
- DB 스키마 변경 규칙: `pnpm db:push` 프로덕션 사용 금지. `drizzle/` 하위 SQL 파일 작성 + `pnpm db:migrate:runtime` 으로 검증
- Drizzle migration 은 `drizzle/meta/_journal.json` 의 entries 를 순서대로 apply
- drizzle-kit `0.31.8` — `pnpm drizzle-kit generate --custom --name <name>` 가 schema diff 없는 빈 SQL + journal 갱신 자동 지원
- `posts.path` = canonical GitHub file path (예: `css/FlexBox/README.md`)
- `posts.isActive` = soft delete

**사용자 결정 (2026-05-10)**:
- **옵션 C** — fix + 백필 둘 다
- 백필: Drizzle migration SQL (`drizzle-kit generate --custom`)

## 모호 영역 사전 명시

| 항목 | 결정 | 정당화 |
|---|---|---|
| Fix 위치 | `performIncrementalSync` 의 `removed`/`renamed` 분기 | EXCLUDED 정책은 "신규 sync 대상에서 제외" 의미. 삭제 이벤트는 정책과 무관하게 DB 정합성 유지 |
| `removed` 분기 — `shouldSyncFile` 가드 제거 후 모든 path deactive 시도 | 무해 (DB 에 없는 path 는 `affectedRows=0` 반환) | EXCLUDED 가 아닌 일반 .md 외 파일도 시도하지만 부작용 없음 |
| `renamed` 분기 — `previous_filename` 의 `shouldSyncFile` 가드도 제거 | 동일 사유 | 이름 변경 후 EXCLUDED 가 된 케이스 (`foo.md` → `README.md`) 도 잔존 차단 |
| `renamed` 분기 — `file.filename` (새 이름) 의 `shouldSyncFile` 가드는 **유지** | 신규 INSERT 는 정책 그대로 | `upsert` 호출은 기존 정책 유지 — README 가 새로 추가되지 않게 |
| 백필 SQL — 매칭 조건 | path basename UPPER 가 `EXCLUDED_FILENAMES` 에 포함 + `is_active=1` | basename 만 비교 (subdirectory 깊이 무관). 이미 inactive 인 row 는 무터치 |
| 백필 SQL — 멱등 | `is_active=1` 조건 + journal 이중 적용 차단 | 두 번 실행해도 무영향 |
| Migration 생성 명령 | `pnpm drizzle-kit generate --custom --name deactivate_excluded_filenames` | drizzle-kit 0.31.8 표준. SQL 파일 + `_journal.json` 자동 갱신 |
| 회귀 테스트 위치 | `SyncService.test.ts` 의 incremental 케이스 | 기존 mock 패턴 재활용 |

## 작업 항목

### 1. `SyncService.performIncrementalSync` 가드 제거

`src/services/SyncService.ts` line 255-282:

기존:
```ts
if (file.status === "removed") {
  if (shouldSyncFile(file.filename)) {
    const ok = await this.postRepo.deactive(file.filename);
    if (ok) deleted++;
    log.info({ filename: file.filename }, `삭제: ${file.filename}`);
  }
} else if (file.status === "renamed") {
  if (file.previous_filename && shouldSyncFile(file.previous_filename)) {
    const ok = await this.postRepo.deactive(file.previous_filename);
    if (ok) deleted++;
    log.info(...);
  }
  if (shouldSyncFile(file.filename)) {
    const result = await this.postSyncService.upsert(file.filename);
    ...
  }
}
```

변경:
```ts
if (file.status === "removed") {
  const ok = await this.postRepo.deactive(file.filename);
  if (ok) deleted++;
  log.info({ filename: file.filename }, `삭제: ${file.filename}`);
} else if (file.status === "renamed") {
  if (file.previous_filename) {
    const ok = await this.postRepo.deactive(file.previous_filename);
    if (ok) deleted++;
    log.info({ filename: file.previous_filename }, `이름 변경(삭제): ${file.previous_filename}`);
  }
  if (shouldSyncFile(file.filename)) {
    const result = await this.postSyncService.upsert(file.filename);
    if (result === "added") added++;
    else if (result === "updated") updated++;
    log.info({ filename: file.filename, result }, `이름 변경(추가): ${file.filename} → ${result}`);
  }
}
```

**핵심**:
- `removed` / `renamed` 의 deactive 호출은 무조건 시도 — DB 에 없으면 `affectedRows=0` 반환 (무해)
- `renamed` 의 신규 이름 (`upsert`) 은 `shouldSyncFile` 가드 유지 — INSERT 정책은 그대로
- 일반 (default) 분기 (`else { if (shouldSyncFile(...)) { upsert } }`) 도 그대로 — INSERT 정책 유지

### 2. Drizzle migration SQL 생성

```bash
# cwd: <repo root>
pnpm drizzle-kit generate --custom --name deactivate_excluded_filenames
```

생성된 빈 SQL 파일 (`drizzle/0007_<adjective>_deactivate_excluded_filenames.sql` 형태) 에 다음 SQL 작성:

```sql
-- Deactivate posts that were synced before EXCLUDED_FILENAMES policy was added.
-- Idempotent — only touches is_active=1 rows whose path basename is an EXCLUDED filename.
UPDATE posts
SET is_active = 0
WHERE is_active = 1
  AND UPPER(SUBSTRING_INDEX(path, '/', -1)) IN (
    'README.MD',
    'AGENTS.MD',
    'CLAUDE.MD',
    'GEMINI.MD',
    'COPILOT.MD',
    'CURSOR.MD',
    'CODERABBIT.MD',
    'CODY.MD'
  );
```

**중요**:
- `--custom` 명령이 SQL 파일 + `drizzle/meta/_journal.json` entry 를 자동 생성 — 둘 다 commit 에 포함
- migration apply 검증: `pnpm db:up && pnpm db:migrate:runtime` 으로 로컬 MySQL 에 적용 확인

### 3. 회귀 테스트

`src/services/SyncService.test.ts` 에 incremental sync 케이스 추가:

```ts
it("incremental sync — README.md (EXCLUDED) 가 removed 이벤트로 들어와도 deactive 호출", async () => {
  const { postSyncService, metadataSyncService, postService, postRepo, syncLogRepo, githubApi } = makeMocks();
  const headSha = "newsha";
  const lastSha = "oldsha";

  vi.mocked(githubApi.getCurrentHeadSha).mockResolvedValue(headSha);
  vi.mocked(syncLogRepo.getLatest).mockResolvedValue({ commitSha: lastSha } as SyncLog);
  vi.mocked(githubApi.getChangedFilesSince).mockResolvedValue([
    { status: "removed", filename: "css/FlexBox/README.md" },
  ] as ChangedFile[]);

  const deactiveSpy = vi.fn().mockResolvedValue(true);
  (postRepo as { deactive: typeof deactiveSpy }).deactive = deactiveSpy;

  const service = new SyncService(postSyncService, metadataSyncService, postService, postRepo, syncLogRepo, githubApi);
  await service.sync();

  expect(deactiveSpy).toHaveBeenCalledWith("css/FlexBox/README.md");
});
```

타입 import (`ChangedFile`) 가 누락되었다면 `@/infra/github/api` 에서 추가.

### 4. 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# migration apply 검증 (로컬 MySQL 컨테이너)
pnpm db:up
pnpm db:migrate:runtime

# 가드 제거 검증
! grep -nE "if \(shouldSyncFile\(file\.filename\)\) \{[[:space:]]*const ok = await this\.postRepo\.deactive" src/services/SyncService.ts
! grep -nE "if \(file\.previous_filename && shouldSyncFile\(file\.previous_filename\)\)" src/services/SyncService.ts

# migration SQL 존재 + 내용 검증
ls drizzle/ | grep deactivate_excluded_filenames
grep -nE "EXCLUDED|README\.MD" drizzle/*deactivate_excluded_filenames*.sql

# journal 갱신 검증
grep -E "deactivate_excluded_filenames" drizzle/meta/_journal.json
```

### 5. 마킹

`tasks/plan038-sync-excluded-deactivate/index.json` — phase 1 + 최상위 `status` = `"completed"`.

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/services/SyncService.ts` | 수정 (incremental removed/renamed 가드 제거) |
| `src/services/SyncService.test.ts` | 수정 (회귀 테스트 추가) |
| `drizzle/0007_*_deactivate_excluded_filenames.sql` | 신규 (백필 SQL — `--custom` 으로 생성) |
| `drizzle/meta/_journal.json` | 수정 (drizzle-kit 자동 갱신) |
| `tasks/plan038-sync-excluded-deactivate/index.json` | 수정 (status completed) |

## Out of Scope

- `EXCLUDED_FILENAMES` 정책 자체 변경 — 본 plan 은 정책 유지 + 정합성 fix 만
- `performFullSync` — 이미 정상 동작
- Service 레이어 self-heal (sync 마다 EXCLUDED 검사) — 1회 백필 + incremental fix 로 충분
- 다른 종류 정합성 (EXCLUDED 가 아닌 deleted post 의 categories drift 등) — plan037 self-heal 범위
- `posts.path` 기반 백필이 아닌 `posts.id=17` 등 개별 row 수동 처리 — migration 으로 통일

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| `removed` 분기에서 `shouldSyncFile` 제거 후 .md 가 아닌 파일 (예: 이미지) 도 deactive 시도 | `postRepo.deactive` 는 `path` 기반 UPDATE — DB 에 없으면 `affectedRows=0` 반환. 부작용 없음 |
| migration SQL 의 MySQL 8 `SUBSTRING_INDEX` 호환성 | MySQL 5.x 부터 지원 — 안전 |
| migration 두 번 실행 | `is_active=1` 조건으로 멱등. journal 이 이중 적용 차단 (안전망 이중) |
| 백필 후 `posts.updatedAt` 갱신 — drift 추적 영향 | `is_active` 변경은 trivial 한 정합성 정정. drift 추적상 1회 spike 는 수용 |
| `EXCLUDED_FILENAMES` 향후 추가 (예: `LICENSE.MD`) | 정책 변경 시 별도 plan 으로 backfill migration 추가. 본 plan 시점 EXCLUDED 만 처리 |
| 테스트 mock — `ChangedFile` 타입 export 여부 | `src/infra/github/api.ts` 의 export 확인 후 import. 기존 SyncService.ts 의 import 패턴 참조 |
