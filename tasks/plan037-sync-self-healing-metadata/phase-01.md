# Phase 01 — sync self-healing metadata + UPSERT 패턴

**Model**: sonnet
**Goal**: sync 호출이 항상 metadata 를 재계산하게 만들어 categories drift 자가 치유. UPSERT + orphan DELETE 로 row id 안정성 확보.

## Context (자기완결)

issue #145 — fos-study 에서 `go/`, `css/`, `react/` 디렉터리 통째 삭제 후 fos-blog sync 했지만 카테고리가 잔존. 진단 결과:

1. SyncService 의 short-circuit 분기 (`lastSyncedSha === headSha` → "Already up to date") 가 `updateCategories` / `syncFolderReadmes` 호출 **앞에서 early return** → posts 변경 없는 sync 호출은 metadata 재계산이 안 됨.
2. 결과: 과거 어느 시점에 metadata drift 가 발생하면 (코드 회귀 / 트랜잭션 부분 실패 등) 자가 복구 경로 없음 — 누군가 강제로 lastSyncedSha 를 리셋해야 정정.

**근본 원인 두 층**:
- **A. 흐름 결함**: short-circuit 이 metadata 재계산을 바이패스
- **B. 리포지토리 패턴 결함**: `CategoryRepository.replaceAll` 이 transaction 으로 DELETE all + INSERT all — id auto-increment 누적 + 매 sync 마다 모든 row touched. 변경 없는 row 도 update timestamp 가 갱신되어 "언제 실제로 바뀌었나" 추적 불가.

**플젝 컨벤션**:
- BaseRepository / Drizzle MySQL pattern
- `categories.name` UNIQUE, `categories.slug` UNIQUE — UPSERT 의 conflict target 으로 사용 가능
- `categoryIcons` (src/infra/db/constants.ts) 가 icon 의 단일 소스 (사용자 결정 — UPSERT 시 icon 항상 overwrite)

**사용자 결정 (2026-05-09)**:
- short-circuit path 에서 `updateCategories` + `syncFolderReadmes` **둘 다** 호출 (full self-heal)
- `?force=true` flag 미도입 — self-heal 만으로 충분
- icon 단일 소스 — UPSERT 시 항상 categoryIcons 값으로 overwrite

## 모호 영역 사전 명시 (좋은 코드 의식)

이 phase 작성 시점에 명시적으로 결정 / 정당화한 항목:

| 항목 | 결정 | 정당화 |
|---|---|---|
| Repository 메서드 이름 | `replaceAll` → `syncAll` | "DELETE+INSERT" 함의의 이름이 새 동작 (UPSERT + orphan DELETE) 을 잘못 전달 — naming = clarity |
| UPSERT conflict target | `categories.name` | name 과 slug 모두 unique 하지만 stats 는 둘 다 동일 string 입력 — name 을 자연 키로 명시 |
| Transaction scope | UPSERT batch + orphan DELETE 한 transaction | 부분 적용 시 일관성 깨짐 — atomic 보장 |
| 빈 stats input | `syncAll([])` 호출 시 모든 row DELETE | post 0 건이면 카테고리 0 건이 정상. 명시적 처리 (no-op 아님) |
| Drizzle MySQL UPSERT API | `.onDuplicateKeyUpdate({ set: { ... } })` | Drizzle MySQL adapter 표준 패턴. PostgreSQL 의 `onConflictDoUpdate` 와 다름 |
| short-circuit early return 의 응답 shape | 기존 그대로 (`upToDate: true, deleted: 0`) | metadata 재계산은 부수효과 — caller 응답 shape 변경 없음 |
| 회귀 테스트 — short-circuit 시 metadata 재계산 검증 | mock 으로 `metadataSyncService.updateCategories` 호출 횟수 검증 | 행위 검증 — 실제 DB 상태 변경은 별도 통합 테스트 영역 |

## 작업 항목

### 1. `CategoryRepository.syncAll` 신규 + `replaceAll` deprecated/제거

`src/infra/db/repositories/CategoryRepository.ts`:

```ts
async syncAll(
  stats: Array<{ name: string; slug: string; icon: string; postCount: number }>,
): Promise<void> {
  await this.db.transaction(async (tx) => {
    // 1. UPSERT 현재 stats — 신규는 INSERT, 기존은 UPDATE
    if (stats.length > 0) {
      await tx
        .insert(categories)
        .values(stats)
        .onDuplicateKeyUpdate({
          set: {
            slug: sql`VALUES(slug)`,
            icon: sql`VALUES(icon)`,
            postCount: sql`VALUES(post_count)`,
          },
        });
    }

    // 2. orphan DELETE — 현재 stats 에 없는 row 제거
    const currentNames = stats.map((s) => s.name);
    if (currentNames.length === 0) {
      await tx.delete(categories);
    } else {
      await tx
        .delete(categories)
        .where(notInArray(categories.name, currentNames));
    }
  });
}
```

기존 `replaceAll` 은 즉시 삭제 (호출자 1곳만 — `MetadataSyncService.updateCategories`).

**중요**:
- `VALUES(column)` 구문은 MySQL 8 에서 deprecated 경고 가능 — Drizzle 내부 처리에 따라 `sql.placeholder` 또는 새 alias 형태 검토. 실행 시점에 deprecated warning 발생하면 phase 종료 전 정정.
- `notInArray` 는 `drizzle-orm` 의 표준 helper.

### 2. `MetadataSyncService.updateCategories` 갱신

`src/services/MetadataSyncService.ts`:

```ts
async updateCategories(): Promise<void> {
  const stats = await this.postRepo.getCategoryStats();
  await this.categoryRepo.syncAll(  // ← replaceAll → syncAll
    stats.map((s) => ({
      name: s.category,
      slug: s.category,
      icon: categoryIcons[s.category] || "📁",
      postCount: s.count,
    })),
  );
}
```

### 3. `SyncService.sync` short-circuit path 수정

`src/services/SyncService.ts` line 71-83 영역:

기존:
```ts
if (lastSyncedSha === headSha) {
  log.info("이미 최신 상태 — 동기화 건너뜀");
  const titles = await this.postService.retitleAll();
  return {
    added: 0, updated: 0, deleted: 0,
    commitSha: headSha, upToDate: true, titles,
  };
}
```

변경:
```ts
if (lastSyncedSha === headSha) {
  log.info("이미 최신 상태 — posts 변경 없음, metadata 만 재계산");
  // self-heal: posts 변경 없어도 categories / folder README drift 가능 → 항상 재계산
  await this.metadataSyncService.updateCategories();
  await this.metadataSyncService.syncFolderReadmes();
  const titles = await this.postService.retitleAll();
  return {
    added: 0, updated: 0, deleted: 0,
    commitSha: headSha, upToDate: true, titles,
  };
}
```

**주의**: 응답 shape (`upToDate: true, deleted: 0`) 는 그대로 유지. metadata 재계산은 caller-invisible 부수효과.

### 4. 회귀 테스트

**4-1. `CategoryRepository.syncAll` 동작 — `MetadataSyncService.test.ts` 갱신**

기존 `replaceAll` 호출 검증을 `syncAll` 로 치환. 입력 shape 동일.

**4-2. `SyncService.test.ts` — short-circuit metadata 재계산 검증**

기존 케이스 "lastSyncedSha === headSha 이면 upToDate: true 를 반환한다" 의 expectation 에 추가:

```ts
expect(metadataSyncService.updateCategories).toHaveBeenCalledTimes(1);
expect(metadataSyncService.syncFolderReadmes).toHaveBeenCalledTimes(1);
```

**4-3. `CategoryRepository` 단위 테스트 신규 (선택)**

테스트가 실제 DB 또는 in-memory MySQL 사용한다면 unit test 추가. 현재 repo 단위 테스트가 없으면 OOS — service 레이어 테스트에 위임.

### 5. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

grep -nE "syncAll|replaceAll" src/infra/db/repositories/CategoryRepository.ts
grep -nE "syncAll" src/services/MetadataSyncService.ts
! grep -nE "categoryRepo\.replaceAll" src/services/MetadataSyncService.ts
grep -nE "metadataSyncService\.updateCategories" src/services/SyncService.ts | wc -l  # 2 이상 (full + incremental + short-circuit)
```

수동 smoke (사용자 안내):
```bash
# production sync 재호출 — Already up to date 응답이지만 metadata 재계산
curl -X POST https://blog.fosworld.co.kr/api/sync \
  -H "Authorization: Bearer $SYNC_API_KEY"

# 응답: {"success":true,"message":"Already up to date","commitSha":"58a425d...","files":{...}}
# 그러나 backend 에서 updateCategories + syncFolderReadmes 실행
# → /categories 페이지 새로고침 → go/css/react 사라짐
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/infra/db/repositories/CategoryRepository.ts` | 수정 (replaceAll → syncAll) |
| `src/services/MetadataSyncService.ts` | 수정 (호출 메서드 이름 갱신) |
| `src/services/SyncService.ts` | 수정 (short-circuit metadata 호출) |
| `src/services/MetadataSyncService.test.ts` | 수정 (mock 메서드 이름 갱신) |
| `src/services/SyncService.test.ts` | 수정 (short-circuit assertion 추가) |

## Out of Scope

- `?force=true` flag 도입 — 사용자 결정상 미도입
- icon 의 admin 수동 설정 UI — 단일 소스 결정으로 OOS
- syncFolderReadmes 자체 최적화 (GitHub API 호출 횟수 절감) — 별도 issue 후보
- folder READMEs 의 자가 치유 (현재도 호출되지만 drift 케이스가 사용자 보고 없어 검증 OOS)

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| `VALUES(column)` MySQL 8 deprecated warning | Drizzle 내부 패턴 추적 — deprecated 시 Drizzle 권장 syntax 로 정정. lint/build 시 warning 캡처 |
| short-circuit 에 metadata 호출 추가로 응답 시간 증가 | updateCategories = 1 SELECT GROUP BY + UPSERT (10 row 미만) — 100ms 이내. syncFolderReadmes = N folder × GitHub API 호출 — 30 폴더 × ~200ms = 6초 가능. caller 가 timeout 짧으면 영향 |
| transaction 내 INSERT batch + DELETE 조합이 잠금 시간 길어짐 | 카테고리 10건 미만 규모 — 무시 가능. 향후 100+ 카테고리 시 batch insert 분할 고려 |
| `notInArray(categories.name, [])` 가 모든 row DELETE 또는 0건 DELETE — Drizzle 동작 확인 필요 | 위 코드는 `currentNames.length === 0` 분기로 명시 처리. 빈 배열 케이스 명확 |
| Drizzle MySQL `onDuplicateKeyUpdate` API 변경 가능성 (lib version drift) | Drizzle docs 확인 후 currently-installed version 의 syntax 명시. version pin 은 별도 |
| 마이그레이션 부재 — schema 변경 없음 | 변경 항목은 코드만 — drizzle migration 불필요 |
