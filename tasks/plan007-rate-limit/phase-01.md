# Phase 01 — rateLimit 구현 + matcher 확장 + 단위 테스트

## 컨텍스트 (자기완결 프롬프트)

홈서버 자원 보호를 위해 Next.js middleware 레벨에서 IP 단위 rate limit 도입(ADR-016). plan006 에서 만든 `src/middleware/rateLimit.ts` placeholder 를 실제 구현으로 교체. fixed window 60초/IP, 분당 60 요청, Googlebot UA 예외, 초과 시 429 + Retry-After.

## 먼저 읽을 문서

- `docs/adr.md` — **ADR-016** (Rate limit 정책)
- `src/middleware/rateLimit.ts` — placeholder (plan006 산출물)
- `src/proxy.ts` — orchestrator (plan006 산출물)
- `src/middleware/visit.ts` — IP 추출 패턴 참고
- `.claude/skills/_shared/common-critic-patterns.md` — BLG2 (구조화 로그), BLG3 (사일런트 실패 금지)

## 기존 코드 참조

- `src/middleware/visit.ts` — `x-forwarded-for` 파싱 동일 로직 (재사용 또는 util 추출)
- `src/lib/logger.ts` — `logger.child` 컨벤션

## 사전 게이트

```bash
# cwd: <worktree root>

# 1) plan006 선행 산출물 존재
test -f src/middleware/rateLimit.ts
test -f src/middleware/visit.ts
grep -n "export function rateLimit" src/middleware/rateLimit.ts
```

존재하지 않으면 **PHASE_BLOCKED: plan006 선행 필요**.

## 작업 목록 (총 4개)

### 1. `src/middleware/rateLimit.ts` 실제 구현

```ts
import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";

const log = logger.child({ module: "middleware/rateLimit" });

const WINDOW_MS = 60_000;          // 1분
const MAX_REQUESTS_PER_WINDOW = 60;
const BOT_UA_PATTERN = /Googlebot/i;

interface Bucket {
  windowKey: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isAllowedBot(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  return BOT_UA_PATTERN.test(ua);
}

/**
 * Fixed window 60초/IP rate limit.
 * - Googlebot UA 는 예외 (UA 위조 가능성은 인지, 본질적 보호는 60/min 한도 자체)
 * - 초과 시 429 + Retry-After: 60
 * - 응답 차단 없음 시 null 반환 (proxy.ts orchestrator 가 통과 처리)
 */
export function rateLimit(request: NextRequest): NextResponse | null {
  if (isAllowedBot(request)) return null;

  const ip = getClientIp(request);
  if (ip === "unknown") return null;

  const now = Date.now();
  const windowKey = Math.floor(now / WINDOW_MS);
  const bucket = buckets.get(ip);

  if (!bucket || bucket.windowKey !== windowKey) {
    buckets.set(ip, { windowKey, count: 1 });
    return null;
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    log.warn(
      {
        component: "middleware.rateLimit",
        operation: "block",
        ip,
        path: request.nextUrl.pathname,
      },
      "rate limit exceeded"
    );
    const retryAfterSeconds = Math.ceil(((windowKey + 1) * WINDOW_MS - now) / 1000);
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfterSeconds)),
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  bucket.count += 1;
  return null;
}
```

설계 메모:
- 매 분 새 윈도우 진입 시 같은 ip key 의 entry 가 새 카운트로 덮어써짐 — 별도 GC 불필요
- 다만 IP 가 매우 많이 다양하면 Map 누적. 실용적으로 60초 동안 본 IP 만 잔존 — 다음 윈도우 진입 시 일치 안 하는 IP 는 그대로 메모리에 남지만 요청 시 덮어써짐. 장기 누적 방지는 별도 cleanup 필요할 수도 — `buckets.size > 10000` 같은 가드 또는 정기 sweep 추가 (선택사항, 본 phase 범위 외)

### 2. `src/proxy.ts` matcher 확장 (정적 자산 제외)

기존 (plan006 결과):
```ts
export const config = {
  matcher: ["/", "/posts/:path*"],
};
```

변경 후:
```ts
export const config = {
  matcher: [
    // visit tracking 대상
    "/",
    "/posts/:path*",
    // rate limit 대상 (정적 자산 제외)
    "/((?!_next/static|_next/image|favicon|logo|og-default|fonts/).*)",
  ],
};
```

주의:
- Next.js matcher 배열은 OR 관계. 기존 visit matcher 와 새 광범위 matcher 가 둘 다 매치되는 경로(`/`, `/posts/...`)는 **한 번만** middleware 실행 (path 단위 dedup)
- `_next/static`, `_next/image`, `favicon`, `logo.png`, `og-default.png`, `public/fonts/*` 자산은 모두 제외

trackVisit 은 기존대로 동작 (자기 가드/skip 로직 유지). rateLimit 은 모든 비-자산 요청에 적용.

### 3. 단위 테스트 — `src/middleware/rateLimit.test.ts`

Vitest 케이스:
- 첫 요청 (bucket 없음) → null 반환 + Map 에 windowKey 1, count 1 저장
- 같은 IP 두 번째 요청 → null + count 2
- 같은 IP 60번째 요청 → null + count 60
- 같은 IP 61번째 요청 → 429 NextResponse + `Retry-After` 헤더
- 윈도우 경계 통과 (`Date.now()` mock 으로 `WINDOW_MS` 진행) → 새 windowKey 로 count 1 리셋
- Googlebot UA → 항상 null (limit 우회)
- IP `unknown` (헤더 없음) → null (제한 안 함)
- 다른 IP 는 서로 독립 카운트

mock:
- `vi.useFakeTimers()` + `vi.setSystemTime(...)` 으로 시간 제어
- `NextRequest` 는 `new Request()` + `new NextRequest()` 패턴
- 매 테스트 `beforeEach` 에서 `buckets.clear()` 또는 module 재import

### 4. 통합 검증

```bash
# cwd: <worktree root>
pnpm test --run src/middleware/
pnpm lint
pnpm type-check
pnpm build
```

수동 smoke (선택, 빌드 산출물에 reflect 됨):
```bash
# 분당 60 초과 시 429 확인 (사용자 수동, dev 또는 stg)
for i in $(seq 1 65); do
  curl -sI -H "User-Agent: Test" http://localhost:3000/ -o /dev/null -w "%{http_code}\n"
done | sort | uniq -c
# 기대: 200 60회 + 429 5회
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) rateLimit 실구현 (no-op 제거)
grep -n "MAX_REQUESTS_PER_WINDOW = 60" src/middleware/rateLimit.ts
grep -n "WINDOW_MS = 60_000" src/middleware/rateLimit.ts
grep -n "Math.floor(now / WINDOW_MS)" src/middleware/rateLimit.ts
grep -n "BOT_UA_PATTERN" src/middleware/rateLimit.ts
grep -n "Googlebot" src/middleware/rateLimit.ts

# 2) 429 응답 + Retry-After
grep -nE "status:\s*429" src/middleware/rateLimit.ts
grep -nE '"Retry-After"' src/middleware/rateLimit.ts

# 3) BLG2 구조화 로거 + BLG3 (logger.warn 사용, 사일런트 차단 금지)
grep -nE 'component:\s*"middleware\.rateLimit"' src/middleware/rateLimit.ts
grep -nE 'operation:\s*"block"' src/middleware/rateLimit.ts
grep -n "log.warn" src/middleware/rateLimit.ts
! grep -nE "console\." src/middleware/rateLimit.ts

# 4) matcher 확장 (정적 자산 제외)
grep -n "_next/static" src/proxy.ts
grep -n "_next/image" src/proxy.ts
grep -n "favicon" src/proxy.ts
grep -nE "fonts/" src/proxy.ts

# 5) 단위 테스트 + 빌드
test -f src/middleware/rateLimit.test.ts
pnpm test --run src/middleware/
pnpm lint
pnpm type-check
pnpm build

# 6) 금지사항 (code-reviewer 반복 지적)
! grep -nE "as any" src/middleware/rateLimit.ts
```

## PHASE_BLOCKED 조건

- Next.js 16 matcher 가 negative lookahead `(?!...)` 직접 지원 안 함 → **PHASE_BLOCKED: matcher 패턴 재설계 필요 (Next.js docs 확인)**
- `vi.useFakeTimers()` 가 `Date.now()` mock 시 buckets Map 동작과 충돌 → **PHASE_BLOCKED: 시간 mock 전략 재검토**
- middleware 가 Edge runtime 으로 강제 실행되어 in-memory Map 공유 안 됨 → **PHASE_BLOCKED: runtime 명시 필요 (현재는 Node runtime 가정)**

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋:
- `feat(middleware): add fixed-window rate limit (60/min/IP, Googlebot exempt)`
- `feat(proxy): expand matcher to cover non-asset paths for rate limit`
