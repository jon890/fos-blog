# Phase 01 — sync 책임 분리와 변경 경로 계약

**Execution profile**: standard
**Status**: pending

---

## 목표

`SyncService`를 오케스트레이터로 축소하고 글과 metadata 동기화가 후속 glossary 색인에 필요한 변경 경로를 반환하게 한다.
기존 `/api/sync` 응답과 성공·실패 기록 동작은 이 phase에서 바꾸지 않는다.

**범위 외**: glossary DB schema, 용어 matcher, 툴팁, `/glossary` 페이지.

## 작업 항목 (4)

### 1. `PostSyncService` — 글 collection 동기화 소유

`src/services/SyncService.ts`의 Markdown 재귀 탐색, full sync, incremental sync 구현을 `src/services/PostSyncService.ts`로 이동한다.

다음 계약을 export한다.

```ts
export type SyncedPageChange = {
  path: string;
  operation: "upsert" | "delete";
};

export type PostSyncResult = {
  added: number;
  updated: number;
  deleted: number;
  changedPosts: SyncedPageChange[];
  titles: { total: number; updated: number; skipped: number };
};
```

`PostSyncService.syncAll()`과 `syncChanged(changedFiles)`가 `PostSyncResult`를 반환한다.
기존 `upsert(filePath)`의 parsing helper와 저장 규칙은 한 경로로 재사용하며 full·incremental 구현을 복제하지 않는다.
`PostService.retitleAll()`은 `PostSyncService`로 흡수하고, repository grep에서 다른 호출자가 없으면 `PostService.ts`와 `createPostService()`를 제거한다.

### 2. `MetadataSyncService` — metadata 갱신 결과 반환

`refresh()`를 추가해 category 재계산과 folder README 동기화를 한 번 호출하고 다음 결과를 반환한다.

```ts
export type MetadataSyncResult = {
  changedReadmes: SyncedPageChange[];
};
```

README가 새로 생기거나 SHA가 바뀌면 `upsert`, 기존 README가 원본에서 사라지면 `delete`를 반환한다.
`FolderRepository`에 README를 `null`로 지우는 명시적 메서드를 추가해 삭제된 원본이 DB에 남지 않게 한다.
현재 활성 post path로 계산한 folder set과 기존 folder DB path도 비교한다.
folder 자체가 현재 set에서 사라진 경우 기존 README를 지우고 `SyncedPageChange { path, operation: "delete" }`를 반환한다.

### 3. `SyncService` — orchestration만 유지

`sync()`는 HEAD 비교, full·incremental 모드 선택, `PostSyncService`, `MetadataSyncService`, `SyncLogRepository` 호출과 결과 조립만 담당한다.
private collection traversal과 post parsing을 남기지 않는다.

HEAD가 같은 short-circuit에서도 `MetadataSyncService.refresh()`를 호출하는 plan037 자가 치유 동작을 보존한다.
실패 시 failed log를 남기고 원래 error를 다시 throw한다.

### 4. 생성 wiring과 회귀 테스트

`src/services/index.ts`, `src/lib/sync-github.ts`, 기존 service 테스트를 새 생성자와 좁은 구조적 mock에 맞춘다.
`as unknown as Repository` cast를 새로 추가하지 않는다.

다음을 테스트한다.

- 첫 sync는 `PostSyncService.syncAll()`을 호출한다.
- compare 실패의 `null`은 full sync로 폴백한다.
- incremental은 `syncChanged()`에 변경 목록을 전달한다.
- short-circuit도 metadata를 갱신한다.
- README 삭제는 DB readme를 지우고 `delete` change를 반환한다.
- 활성 post가 사라져 folder 자체가 소멸한 경우에도 README `delete` change를 반환한다.
- 실패 log와 throw 계약을 보존한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/services/SyncService.ts` | orchestration 전용으로 축소 |
| `src/services/PostSyncService.ts` | collection full·incremental 처리 흡수 |
| `src/services/PostService.ts` | title 보정 흡수 후 호출자 없으면 삭제 |
| `src/services/MetadataSyncService.ts` | `refresh()`와 README change 반환 |
| `src/infra/db/repositories/FolderRepository.ts` | README 삭제 메서드 추가 |
| `src/services/index.ts` | 생성 wiring 갱신 |
| `src/services/SyncService.test.ts` | orchestration 회귀 테스트 |
| `src/services/PostSyncService.test.ts` | full·incremental·변경 경로 테스트 |
| `src/services/MetadataSyncService.test.ts` | README change 테스트 |
| `src/services/PostService.test.ts` | title 보정 테스트를 이동한 뒤 삭제 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog/.claude/worktrees/plan054-glossary-tooltip
# branch: feat/plan054-glossary-tooltip
pnpm test src/services/SyncService.test.ts src/services/PostSyncService.test.ts src/services/MetadataSyncService.test.ts
pnpm type-check
! rg -n "collectMarkdownFiles|performFullSync|performIncrementalSync" src/services/SyncService.ts
```

기대값:

- 테스트와 type-check exit code가 0이다.
- 마지막 `rg` 출력이 0줄이다.

## 의도 메모 (왜)

- `SyncService` 공개 `sync()` 계약을 보존해 API route와 cron 호출자를 깨뜨리지 않는다.
- 범용 task registry는 서로 다른 post, metadata, glossary 실패 계약을 숨기므로 도입하지 않는다.
- 최근 plan037의 short-circuit metadata 자가 치유가 final state이며 이번 분리 이후에도 유지한다.
