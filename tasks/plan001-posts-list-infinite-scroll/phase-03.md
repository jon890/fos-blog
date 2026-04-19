# Phase 03 — API Route 2개 + 통합 테스트

## 컨텍스트 (자기완결 프롬프트)

Phase-02에서 만든 Repository 메서드를 활용해 Next.js App Router Route Handler 2개를 구현한다. 무한 스크롤 클라이언트가 호출할 엔드포인트.

## 먼저 읽을 문서

- `docs/code-architecture.md` — §5 "API Route 응답 스펙", §6 "Logger 컨벤션"
- `docs/adr.md` — ADR-004 (API Route 선택)
- `src/app/AGENTS.md`
- `CLAUDE.md` — 환경 변수 및 Next.js 16 App Router 규칙

## 기존 코드 참조

- `src/app/api/sync/route.ts` — 기존 API Route 패턴 (응답/에러/로거)
- `src/lib/logger.ts` — `logger.child` 컨벤션
- `src/infra/db/repositories/index.ts` — `getRepositories()` 호출부

## 작업 목록 (총 4개)

### 1. `GET /api/posts/latest` Route Handler

파일: `src/app/api/posts/latest/route.ts`

```ts
export async function GET(request: Request): Promise<Response>
```

동작:
1. URL 쿼리에서 `limit` (default 10, clamp 1~30), `cursor` 파싱
2. `cursor` 형식: `<iso8601>:<id>` — 파싱 실패 시 400 반환
3. `PostRepository.getRecentPostsCursor({ limit, cursor })` 호출
4. `VisitRepository.getPostVisitCounts(paths)` 병렬 조회
5. `items`에 visitCount merge
6. `nextCursor`: items.length === limit 이면 마지막 item의 `<updatedAt>:<id>` 조합, 아니면 `null`
7. 응답: `{ items, nextCursor }`
8. 에러 시 BLG2 4-field 로거 + 500 + `{ error: "..." }` 응답 (BLG3 준수)

※ `updatedAt`은 Repository에서 반환되지 않음 (기존 `PostData`는 `createdAt`/`updatedAt` 미포함). nextCursor 생성용으로 필요하므로:
- 옵션 A: `getRecentPostsCursor` 반환 타입에 `updatedAt, id` 추가
- 옵션 B: Route에서 별도로 조회
→ **옵션 A 선택** (한 번 쿼리로 끝). Phase-02에서 반환 DTO에 `updatedAt: Date, id: number` 포함. 응답에서는 `updatedAt`을 **제외**하고 `nextCursor` 계산 후 버림.

이 요구사항은 Phase-02 작업 항목 1에 역으로 반영해야 하므로, **executor는 Phase-02 시그니처를 이 phase 실행 시점에 확장**한다:
```ts
// 확장된 시그니처
async getRecentPostsCursor(...): Promise<Array<PostData & { updatedAt: Date; id: number }>>
```

### 2. `GET /api/posts/popular` Route Handler

파일: `src/app/api/posts/popular/route.ts`

동작:
1. 쿼리 `limit` (default 10, clamp 1~30), `offset` (default 0, ≥ 0 아니면 400)
2. 병렬: `VisitRepository.getPopularPostPathsOffset({ limit, offset })` + `VisitRepository.getPopularPostPathsTotal()`
3. `paths`로 `PostRepository.getPostsByPaths(paths)` 조회
4. reorder: `paths` 순서대로 `postDataList` 재정렬 (Map 활용)
5. visitCount merge
6. `hasMore`: `offset + items.length < total`
7. 응답: `{ items, hasMore }`
8. 에러 시 BLG2 로거 + 500 응답

### 3. API Route 통합 테스트 — latest

파일: `src/app/api/posts/latest/route.test.ts` (신규)

Vitest + `vi.mock('@/infra/db/repositories')` 패턴. 검증:
- 200 응답 shape (`items`, `nextCursor`)
- cursor 미지정 시 첫 페이지
- cursor 지정 파싱 + 전달
- cursor 파싱 실패 시 400
- `getRecentPostsCursor`가 throw 하면 500 + logger 4-field 호출

### 4. API Route 통합 테스트 — popular

파일: `src/app/api/posts/popular/route.test.ts` (신규)

검증:
- 200 응답 shape (`items`, `hasMore`)
- offset 적용
- 음수 offset → 400
- `getPopularPostPathsOffset` throw → 500 + 로거 호출
- reorder 로직: paths 순서와 postDataList 불일치 상황에서 paths 기준 정렬 확인

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) Route 파일 존재 + GET export
grep -n "export async function GET" src/app/api/posts/latest/route.ts
grep -n "export async function GET" src/app/api/posts/popular/route.ts

# 2) Response 스펙 키워드 포함 (sanity)
grep -n "nextCursor" src/app/api/posts/latest/route.ts
grep -n "hasMore" src/app/api/posts/popular/route.ts

# 3) Logger 4-field 구조화 (BLG2)
grep -nE "logger\.(error|warn)\(\s*\{[^}]*component" src/app/api/posts/latest/route.ts
grep -nE "logger\.(error|warn)\(\s*\{[^}]*component" src/app/api/posts/popular/route.ts

# 4) 테스트 통과
pnpm test --run src/app/api/posts/

# 5) 타입 체크 + 린트
pnpm type-check
pnpm lint

# 6) 사일런트 실패 없음 (BLG3) — catch에서 빈 응답 반환 금지
! grep -nE "catch\s*\(.*\)\s*\{\s*return\s+Response\.json\(\s*\{\s*items:\s*\[\]" src/app/api/posts/
```

## PHASE_BLOCKED 조건

- Next.js 16에서 Route Handler 타입 변경으로 기존 패턴 미호환 → **PHASE_BLOCKED: Next.js 16 Route Handler 마이그레이션 가이드 확인 필요**
- Repository mock 구조가 API route 테스트와 호환 안 됨 → **PHASE_BLOCKED: getRepositories() mocking 전략 재설계**

## 커밋 제외

이 phase는 커밋하지 않는다.
