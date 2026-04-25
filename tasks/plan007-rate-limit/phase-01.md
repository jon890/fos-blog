# Phase 01 — rateLimit 구현 + matcher 확장 + 단위 테스트

## 컨텍스트 (자기완결 프롬프트)

홈서버 자원 보호를 위해 Next.js middleware 레벨에서 IP 단위 rate limit 도입(ADR-016). plan006 에서 만든 `src/middleware/rateLimit.ts` placeholder 를 실제 구현으로 교체. fixed window 60초/IP, 분당 60 요청, Googlebot UA + localhost 예외, 초과 시 429 + Retry-After. `src/proxy.ts` 에 Node Runtime 명시 + matcher 확장. in-memory `Map` 메모리 누수 방지를 위한 sweep 가드 포함.

## 먼저 읽을 문서

- `docs/adr.md` — **ADR-016** (Rate limit 정책 — Runtime/localhost 예외/메모리 가드 포함)
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

### 1. `src/middleware/rateLimit.ts` 실제 구현 (localhost 예외 + 메모리 가드 포함)

```ts
import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";

const log = logger.child({ module: "middleware/rateLimit" });

const WINDOW_MS = 60_000;          // 1분
const MAX_REQUESTS_PER_WINDOW = 60;
const MAX_BUCKETS = 10_000;
const BOT_UA_PATTERN = /Googlebot/i;
const LOCALHOST_IPS = new Set(["127.0.0.1", "::1"]);

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
 * MAX_BUCKETS 초과 시 현재 windowKey 와 다른 만료된 entry 일괄 제거.
 * 활성 IP(현재 윈도우) 카운트는 보존.
 */
function sweepExpiredBuckets(currentWindowKey: number): void {
  for (const [ip, bucket] of buckets) {
    if (bucket.windowKey !== currentWindowKey) {
      buckets.delete(ip);
    }
  }
}

/**
 * Fixed window 60초/IP rate limit.
 * - Googlebot UA + localhost(127.0.0.1/::1) 는 예외 (cron 자기 호출 보호)
 * - 초과 시 429 + Retry-After
 * - 통과 시 null 반환 (proxy.ts orchestrator 가 통과 처리)
 */
export function rateLimit(request: NextRequest): NextResponse | null {
  if (isAllowedBot(request)) return null;

  const ip = getClientIp(request);
  if (ip === "unknown" || LOCALHOST_IPS.has(ip)) return null;

  const now = Date.now();
  const windowKey = Math.floor(now / WINDOW_MS);
  const bucket = buckets.get(ip);

  if (!bucket || bucket.windowKey !== windowKey) {
    if (buckets.size >= MAX_BUCKETS) sweepExpiredBuckets(windowKey);
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
- `LOCALHOST_IPS` 우회는 외부 노출 없는 것으로 가정 (홈서버 nginx 가 외부 클라이언트 IP 를 그대로 forward — 외부 클라이언트가 `127.0.0.1` 로 접근할 수 없음)
- `sweepExpiredBuckets` 는 size cap 도달 시에만 실행 — 일반 path 비용 0
- 매 분 새 windowKey 진입 시 같은 IP 의 count 가 자연 리셋 (덮어쓰기) — 활성 IP 의 메모리는 항상 1 entry

### 2. `src/proxy.ts` Node Runtime 명시 + matcher 확장

기존 (plan006 결과):
```ts
export const config = {
  matcher: ["/", "/posts/:path*"],
};
```

변경 후:
```ts
export const config = {
  runtime: "nodejs",
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
- `runtime: "nodejs"` 는 Next.js 16 middleware 에서 in-memory Map 동작 보장의 핵심 — 현재 visit.ts 가 mysql2 의존으로 자동 Node 강제 중이지만, 미래 안전장치로 명시
- Next.js matcher 배열은 OR 관계. 같은 path 중복 매치는 한 번만 실행
- `_next/static`, `_next/image`, `favicon`, `logo.png`, `og-default.png`, `public/fonts/*` 자산은 모두 제외

### 3. 단위 테스트 — `src/middleware/rateLimit.test.ts`

Vitest 케이스:
- 첫 요청 (bucket 없음) → null + Map 에 windowKey/count=1 저장
- 같은 IP 60번째 요청 → null + count 60
- 같은 IP 61번째 요청 → 429 NextResponse + `Retry-After` 헤더
- 윈도우 경계 통과 (`vi.setSystemTime` 으로 `WINDOW_MS` 진행) → 새 windowKey 로 count 1 리셋
- Googlebot UA → 항상 null (limit 우회)
- localhost IP `127.0.0.1` / `::1` → 항상 null (우회)
- IP `unknown` (헤더 없음) → null
- 다른 IP 는 서로 독립 카운트
- **메모리 가드**: `MAX_BUCKETS` 도달 후 새 windowKey 진입 시 만료 entry sweep + 활성 windowKey entry 보존

mock/패턴:
- `vi.useFakeTimers()` + `vi.setSystemTime(...)` 으로 시간 제어
- `NextRequest` 는 `new NextRequest("http://...", { headers })` 패턴
- 매 테스트 `beforeEach` 에서 `vi.resetModules()` + 동적 `import` 로 buckets Map 초기화 (top-level const 라 외부 reset 불가)

### 4. 통합 검증

```bash
# cwd: <worktree root>
pnpm test --run src/middleware/
pnpm lint
pnpm type-check
pnpm build
```

수동 smoke (선택, dev 서버에서 사용자 직접):
```bash
for i in $(seq 1 65); do
  curl -sI -H "User-Agent: Test" -H "X-Forwarded-For: 1.2.3.4" http://localhost:3000/ -o /dev/null -w "%{http_code}\n"
done | sort | uniq -c
# 기대: 200 60회 + 429 5회
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) rateLimit 실구현 (no-op 제거)
grep -n "MAX_REQUESTS_PER_WINDOW = 60" src/middleware/rateLimit.ts
grep -n "WINDOW_MS = 60_000" src/middleware/rateLimit.ts
grep -n "MAX_BUCKETS = 10_000" src/middleware/rateLimit.ts
grep -n "Math.floor(now / WINDOW_MS)" src/middleware/rateLimit.ts
grep -n "BOT_UA_PATTERN" src/middleware/rateLimit.ts
grep -n "Googlebot" src/middleware/rateLimit.ts

# 2) localhost 예외 + 메모리 sweep
grep -nE 'LOCALHOST_IPS\s*=\s*new Set' src/middleware/rateLimit.ts
grep -n '"127.0.0.1"' src/middleware/rateLimit.ts
grep -n '"::1"' src/middleware/rateLimit.ts
grep -n "sweepExpiredBuckets" src/middleware/rateLimit.ts
grep -n "buckets.size >= MAX_BUCKETS" src/middleware/rateLimit.ts

# 3) 429 응답 + Retry-After
grep -nE "status:\s*429" src/middleware/rateLimit.ts
grep -nE '"Retry-After"' src/middleware/rateLimit.ts

# 4) BLG2 구조화 로거 + BLG3 (logger.warn 사용, 사일런트 차단 금지)
grep -nE 'component:\s*"middleware\.rateLimit"' src/middleware/rateLimit.ts
grep -nE 'operation:\s*"block"' src/middleware/rateLimit.ts
grep -n "log.warn" src/middleware/rateLimit.ts
! grep -nE "console\." src/middleware/rateLimit.ts

# 5) proxy.ts: Node Runtime 명시 + matcher 확장
grep -nE 'runtime:\s*"nodejs"' src/proxy.ts
grep -n "_next/static" src/proxy.ts
grep -n "_next/image" src/proxy.ts
grep -n "favicon" src/proxy.ts
grep -nE "fonts/" src/proxy.ts

# 6) 단위 테스트 + 빌드
test -f src/middleware/rateLimit.test.ts
pnpm test --run src/middleware/
pnpm lint
pnpm type-check
pnpm build

# 7) 금지사항 (code-reviewer 반복 지적)
! grep -nE "as any" src/middleware/rateLimit.ts
```

## PHASE_BLOCKED 조건

- Next.js 16 matcher 가 negative lookahead `(?!...)` 직접 지원 안 함 → **PHASE_BLOCKED: matcher 패턴 재설계 필요 (Next.js docs 확인)**
- `runtime: "nodejs"` 가 middleware config 에서 직접 지원 안 됨 → **PHASE_BLOCKED: Node Runtime 강제 방법 재확인 (Next.js 16 docs)**
- `vi.useFakeTimers()` 가 `Date.now()` mock 시 buckets Map 동작과 충돌 → **PHASE_BLOCKED: 시간 mock 전략 재검토 (vi.resetModules 패턴)**

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋:
- `feat(middleware): add fixed-window rate limit (60/min/IP, Googlebot/localhost exempt)`
- `feat(proxy): expand matcher + pin Node runtime for in-memory rate limit`
