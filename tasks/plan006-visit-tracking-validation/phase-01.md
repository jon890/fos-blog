# Phase 01 — middleware 파일 분리 + visit 경로 유효성 + cleanup 마이그레이션

## 컨텍스트 (자기완결 프롬프트)

`src/proxy.ts` 가 모든 요청을 visit_stats 에 기록하여 SQL injection 시도 등 악성 path 가 누적되고 홈 조회수가 부풀려지는 버그(ADR-015) 수정. middleware 책임을 파일로 분리하고, visit 기록 시 `posts.path` DB 존재 검증 + 길이 가드 + 목록 페이지 early return 추가. 기존 쌓인 악성/이상 row 는 일회성 마이그레이션으로 cleanup.

## 먼저 읽을 문서

- `docs/adr.md` — **ADR-015** (visit tracking 경로 유효성 + middleware 분리)
- `src/proxy.ts` — 현재 middleware 단일 파일 (line 1-44)
- `src/infra/db/repositories/PostRepository.ts` — `getPostId(slug)` 메서드 (이미 존재)
- `src/infra/db/repositories/VisitRepository.ts` — `recordVisit(pagePath, ipHash)`
- `src/lib/logger.ts` — `logger.child({ module })` 컨벤션 (BLG2)
- `.claude/skills/_shared/common-critic-patterns.md` — BLG1 (db:push 금지), BLG2 (구조화 로그), BLG3 (사일런트 실패 금지)

## 기존 코드 참조

- `src/proxy.ts:1-44` — 현재 middleware 구조 (Node runtime, `crypto.createHash` + `getDb()` 직접 사용)
- `src/proxy.ts:30` — `console.error` BLG2 위반 (logger 로 교체 대상)
- `src/proxy.ts:39-44` — `matcher: ["/", "/posts/:path*"]` (유지)
- `src/infra/db/repositories/PostRepository.ts` — `getPostId(slug): Promise<number | null>` 시그니처 활용

## 사전 게이트 (작업 시작 전 필수)

```bash
# cwd: <worktree root>

# 1) MySQL 컨테이너 가동 확인 (마이그레이션 검증용)
#    container 이름: fos-blog-mysql. 미가동 시 'docker compose -f local/docker-compose.yml up -d' 로 기동
docker ps --format '{{.Names}} {{.Status}}' | grep -E "^fos-blog-mysql " || {
  echo "PHASE_BLOCKED: fos-blog-mysql 컨테이너 미가동"; exit 1;
}

# 2) drizzle-kit custom 마이그레이션 지원 확인
pnpm drizzle-kit --version | grep -E "^drizzle-kit"
```

## 작업 목록 (총 5개)

### 1. `src/middleware/visit.ts` 신규 — visit tracking 함수 분리

파일: `src/middleware/visit.ts`

```ts
import { NextRequest, NextFetchEvent } from "next/server";
import { createHash } from "crypto";
import { getDb } from "@/infra/db";
import { VisitRepository } from "@/infra/db/repositories/VisitRepository";
import { PostRepository } from "@/infra/db/repositories/PostRepository";
import logger from "@/lib/logger";

const log = logger.child({ module: "middleware/visit" });

const SKIP_PATHS = new Set(["/posts/latest", "/posts/popular"]);
const MAX_PATH_LENGTH = 300;

/**
 * 응답 차단 없이 방문 기록을 비동기로 처리한다.
 * - `/`: 항상 기록 (`/` 자체)
 * - `/posts/...`: pathname → posts.path 변환 후 DB 존재 시에만 기록
 * - `/posts/latest|popular`: noindex 목록 페이지 — early return
 * - 길이 > 300 path: 가드 차단 (공격 페이로드 무시)
 */
export function trackVisit(request: NextRequest, event: NextFetchEvent): void {
  const pathname = request.nextUrl.pathname;

  if (pathname.length > MAX_PATH_LENGTH) return;
  if (SKIP_PATHS.has(pathname)) return;

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const visitPromise = (async () => {
    try {
      let pagePath: string | null = null;

      if (pathname === "/") {
        pagePath = "/";
      } else if (pathname.startsWith("/posts/")) {
        const postPath = decodeURIComponent(pathname.replace("/posts/", ""));
        const db = getDb();
        const postRepo = new PostRepository(db);
        const exists = await postRepo.getPostId(postPath);
        if (!exists) return;
        pagePath = postPath;
      } else {
        return;
      }

      const db = getDb();
      const visitRepo = new VisitRepository(db);
      const ipHash = createHash("sha256").update(clientIp).digest("hex");
      await visitRepo.recordVisit(pagePath, ipHash);
    } catch (error) {
      log.error(
        {
          component: "middleware.visit",
          operation: "recordVisit",
          pathname,
          err: error instanceof Error ? error : new Error(String(error)),
        },
        "visit record failed"
      );
    }
  })();

  event.waitUntil(visitPromise);
}
```

핵심 포인트:
- `getDb()` 1회 재사용 (PostRepository + VisitRepository 동일 db 인스턴스 가능 — 기존 패턴 따름)
- 길이/skip 가드는 동기 단계 (DB 조회 전 차단)
- `posts.path` 존재 검증 후에만 `recordVisit`
- BLG2 4-field 로거 (`component, operation, pathname, err`)
- BLG3: catch 에서 silently return 하지 않고 logger.error 로 명시 (응답에는 영향 없음 — `waitUntil` 내부)

### 2. `src/middleware/rateLimit.ts` 신규 — placeholder

파일: `src/middleware/rateLimit.ts`

```ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Rate limiting placeholder. 실제 구현은 plan007 에서.
 * 현재는 모든 요청 통과 (no-op).
 */
export function rateLimit(_request: NextRequest): NextResponse | null {
  return null; // null = 통과, NextResponse = 차단
}
```

이 phase 는 visit tracking 분리만. rate limit 본 구현은 plan007. 단, 파일 구조를 미리 만들어 plan007 에서 import 만 추가하면 되도록 placeholder 유지.

### 3. `src/proxy.ts` 재작성 — orchestrator 로 단순화

기존 1-44 라인 전체를 다음으로 교체:

```ts
import { NextRequest, NextFetchEvent, NextResponse } from "next/server";
import { trackVisit } from "@/middleware/visit";
import { rateLimit } from "@/middleware/rateLimit";

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const limitResponse = rateLimit(request);
  if (limitResponse) return limitResponse;

  trackVisit(request, event);

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/posts/:path*"],
};
```

- `console.error` 제거됨 (visit.ts 에서 logger 로 처리)
- matcher 는 visit 용으로 유지. rate limit 은 plan007 에서 별도 matcher 추가 또는 matcher 확장 검토

### 4. cleanup 마이그레이션 — `drizzle-kit generate --custom`

```bash
# cwd: <worktree root>
pnpm drizzle-kit generate --custom --name cleanup_stale_visits
```

생성된 빈 .sql 파일 (예: `drizzle/00XX_cleanup_stale_visits.sql`) 을 다음 내용으로 채움:

```sql
-- ADR-015: visit_logs / visit_stats 에 누적된 비유효 path row cleanup.
-- 활성/비활성 무관 posts.path 에 매치되는 row 는 보존 (비활성 글 visit 도 보존).
-- 홈 ('/') 도 보존.

DELETE FROM visit_logs
WHERE page_path <> '/'
  AND page_path NOT IN (SELECT path FROM posts);

DELETE FROM visit_stats
WHERE page_path <> '/'
  AND page_path NOT IN (SELECT path FROM posts);
```

`drizzle/meta/_journal.json` 에 새 엔트리 자동 추가됨 (custom 옵션이 처리).

### 5. 단위 테스트 + 통합 검증

파일: `src/middleware/visit.test.ts` (신규)

Vitest 케이스:
- pathname 이 `/posts/latest` → `recordVisit` 호출되지 않음
- pathname 이 `/posts/popular` → 호출되지 않음
- pathname.length > 300 → 호출되지 않음
- pathname 이 `/` → `recordVisit("/", ipHash)` 호출
- pathname 이 `/posts/abc.md` 이고 `getPostId` 가 null → `recordVisit` 호출되지 않음
- pathname 이 `/posts/abc.md` 이고 `getPostId` 가 number → `recordVisit("abc.md", ipHash)` 호출
- pathname 이 `/foo` (matcher 외) → 호출되지 않음 (`return`)

mock 패턴: `vi.mock("@/infra/db/repositories/PostRepository")`, `vi.mock("@/infra/db/repositories/VisitRepository")`, `event.waitUntil` 의 promise 를 await 하여 검증.

테스트 통과 + 통합 검증:
```bash
# cwd: <worktree root>
pnpm test --run src/middleware/
pnpm lint
pnpm type-check
pnpm build
```

마이그레이션 dry-run:
```bash
# cwd: <worktree root>
pnpm db:migrate
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) middleware 파일 분리
test -f src/middleware/visit.ts
test -f src/middleware/rateLimit.ts
grep -n "export function trackVisit" src/middleware/visit.ts
grep -n "export function rateLimit" src/middleware/rateLimit.ts

# 2) proxy.ts orchestrator 단순화
grep -n "import { trackVisit }" src/proxy.ts
grep -n "import { rateLimit }" src/proxy.ts
! grep -n "console\.error" src/proxy.ts
! grep -n "console\.error" src/middleware/visit.ts

# 3) 가드 + skip 로직 존재
grep -n "MAX_PATH_LENGTH" src/middleware/visit.ts
grep -nE "SKIP_PATHS|/posts/latest|/posts/popular" src/middleware/visit.ts
grep -n "getPostId" src/middleware/visit.ts

# 4) BLG2 4-field 로거 패턴
grep -nE 'component:\s*"middleware\.visit"' src/middleware/visit.ts
grep -nE 'operation:\s*"recordVisit"' src/middleware/visit.ts
grep -n "err:" src/middleware/visit.ts

# 5) cleanup 마이그레이션 SQL 존재 + 내용
ls drizzle/*cleanup_stale_visits*.sql | head -1 | xargs grep -l "DELETE FROM visit_logs"
ls drizzle/*cleanup_stale_visits*.sql | head -1 | xargs grep -l "DELETE FROM visit_stats"
ls drizzle/*cleanup_stale_visits*.sql | head -1 | xargs grep -l "page_path <> '/'"
ls drizzle/*cleanup_stale_visits*.sql | head -1 | xargs grep -l "NOT IN (SELECT path FROM posts)"

# 6) drizzle journal 갱신 확인
git diff --name-only | grep -E "drizzle/meta/_journal\.json"

# 7) 단위 테스트 + 빌드
test -f src/middleware/visit.test.ts
pnpm test --run src/middleware/
pnpm lint
pnpm type-check
pnpm build

# 8) 마이그레이션 apply 성공
pnpm db:migrate
```

## PHASE_BLOCKED 조건

- `pnpm drizzle-kit generate --custom` 미지원 또는 옵션 변경됨 → **PHASE_BLOCKED: drizzle-kit 버전별 custom migration 문법 재확인 필요**
- `pnpm db:migrate` 가 cleanup SQL 적용 시 FK/lock 에러 → **PHASE_BLOCKED: 마이그레이션 격리 + 트랜잭션 검토 필요**
- 단위 테스트 mock 구조가 `event.waitUntil` async 검증과 호환 안 됨 → **PHASE_BLOCKED: testing 전략 재검토 (vi.spyOn + await flushPromises 패턴)**

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋:
- `refactor(middleware): split proxy into visit + rateLimit modules`
- `feat(middleware): validate post path before recording visit`
- `chore(db): add cleanup_stale_visits migration (ADR-015)`
