# Phase 02 — Repository 신규 메서드 + 단위 테스트

## 컨텍스트 (자기완결 프롬프트)

Phase-01에서 추가한 인덱스를 활용하는 Repository 메서드 3개를 추가한다. 모든 메서드는 `is_active = 1` 필터 유지. Drizzle 쿼리 패턴은 기존 `PostRepository`/`VisitRepository` 스타일을 따르고, Vitest 단위 테스트로 경계 케이스 검증.

## 먼저 읽을 문서

- `docs/data-schema.md` — §4 "Repository 신규 메서드"
- `docs/adr.md` — ADR-002 (composite cursor / offset + tie-break)
- `docs/code-architecture.md` — §6 logger 규칙 (BLG2)
- `src/infra/db/repositories/AGENTS.md`

## 기존 코드 참조

- `src/infra/db/repositories/PostRepository.ts` — `getRecentPosts`, `getPostsByPaths` 패턴
- `src/infra/db/repositories/VisitRepository.ts` — `getPopularPostPaths` 패턴
- `src/services/SyncService.test.ts` — Vitest + `vi.mock()` Repository 패턴
- `src/services/PostService.test.ts` — 단위 테스트 구조
- `src/infra/db/types.ts` — `PostData` 타입

## 작업 목록 (총 5개)

### 1. `PostRepository.getRecentPostsCursor` 추가

```ts
async getRecentPostsCursor(params: {
  limit: number;
  cursor?: { updatedAt: Date; id: number };
}): Promise<PostData[]>
```

SQL 의미:
```
WHERE is_active = 1
  AND (cursor IS NULL OR (updated_at, id) < (:cursorUpdatedAt, :cursorId))
ORDER BY updated_at DESC, id DESC
LIMIT :limit
```

Drizzle 튜플 비교는 `sql` 템플릿으로:
```ts
import { and, eq, desc, sql } from "drizzle-orm";

const whereExpr = cursor
  ? and(
      eq(posts.isActive, true),
      sql`(${posts.updatedAt}, ${posts.id}) < (${cursor.updatedAt}, ${cursor.id})`
    )
  : eq(posts.isActive, true);
```

반환 필드는 `getRecentPosts` 와 동일 (`title, path, slug, category, subcategory, folders, description`). `folders` null-guard 유지.

### 2. `VisitRepository.getPopularPostPathsOffset` 추가

```ts
async getPopularPostPathsOffset(params: {
  limit: number;
  offset: number;
}): Promise<Array<{ path: string; visitCount: number }>>
```

SQL 의미:
```
SELECT page_path, visit_count FROM visit_stats
ORDER BY visit_count DESC, page_path ASC
LIMIT :limit OFFSET :offset
```

기존 `getPopularPostPaths`와 달리 `path` 2차 정렬 키 포함 — 안정성 확보.

### 3. `VisitRepository.getPopularPostPathsTotal` 추가

```ts
async getPopularPostPathsTotal(): Promise<number>
```

SQL:
```
SELECT COUNT(*) AS total FROM visit_stats
```

에러 시 `logger.error({ component, operation, err }, ...)` 4-field로 로깅 + `throw` (BLG3 사일런트 실패 금지). 기존 `try { ... } catch { return 0; }` 패턴이 아니라 **명시적 throw** — API layer가 500으로 응답.

### 4. PostRepository 단위 테스트 신규 파일

`src/infra/db/repositories/PostRepository.test.ts` (기존 없음 → 신규 생성)

아래 케이스 검증:
- `getRecentPostsCursor({ limit: 10 })` — cursor 없을 때 상위 10개 (목 DB)
- `getRecentPostsCursor({ limit: 10, cursor })` — cursor 이후 범위만
- `getRecentPostsCursor({ limit: 10 })` — `is_active = false` 필터링

mock은 Drizzle `db` 객체를 `vi.mock`으로 대체. 기존 `SyncService.test.ts` 스타일.

### 5. VisitRepository 단위 테스트 신규 파일

`src/infra/db/repositories/VisitRepository.test.ts` (기존 없음 → 신규 생성)

아래 케이스:
- `getPopularPostPathsOffset({ limit: 10, offset: 0 })` — 상위 10개
- `getPopularPostPathsOffset({ limit: 10, offset: 20 })` — offset 적용
- `getPopularPostPathsTotal()` — 합계 반환
- DB 에러 시 `getPopularPostPathsTotal`이 throw + logger 호출 (구조화 4-field)

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 메서드 시그니처 확인
grep -n "getRecentPostsCursor" src/infra/db/repositories/PostRepository.ts
grep -n "getPopularPostPathsOffset" src/infra/db/repositories/VisitRepository.ts
grep -n "getPopularPostPathsTotal" src/infra/db/repositories/VisitRepository.ts

# 2) 테스트 파일 존재
test -f src/infra/db/repositories/PostRepository.test.ts
test -f src/infra/db/repositories/VisitRepository.test.ts

# 3) 테스트 통과
pnpm test --run src/infra/db/repositories/

# 4) 타입 체크
pnpm type-check

# 5) logger 구조화 4-field 준수 확인 (BLG2)
grep -nE "logger.*error.*\{[^}]*component[^}]*operation[^}]*err" src/infra/db/repositories/VisitRepository.ts

# 6) catch 빈 swallow 없음 (BLG3)
! grep -nE "catch\s*\{\s*return\s+(null|\[\]|\{\});?\s*\}" src/infra/db/repositories/VisitRepository.ts | grep -v "기존허용범위"
```

(성공 기준 6은 기존 코드의 `catch { return 0; }` 패턴은 **보존**. 신규 메서드 `getPopularPostPathsTotal`에만 엄격 적용 — grep 범위를 함수 단위로 좁혀 검증.)

## PHASE_BLOCKED 조건

- Drizzle 튜플 비교 문법이 MySQL 방언에서 동작 안 함 → **PHASE_BLOCKED: raw SQL 서브쿼리로 전환 설계 필요**
- 단위 테스트 mock 구조가 기존 test 파일과 호환 안 됨 → **PHASE_BLOCKED: 테스트 전략 재검토 필요**

## 커밋 제외

이 phase는 커밋하지 않는다.
