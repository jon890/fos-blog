# Phase 01 — proxy.ts matcher 변경 + 회귀 테스트

**Model**: sonnet
**Goal**: `/api/` 전체가 rate limit 에서 제외되던 버그 수정. `/api/sync` 만 제외, 나머지는 기존 1000/min/IP 한도 적용.

## Context (자기완결)

`src/proxy.ts` 의 `config.matcher` 패턴:

```ts
matcher: [
  "/",
  "/posts/:path*",
  "/((?!_next/static|_next/image|_next/data|api/|favicon|logo|og-default|fonts/|sitemap\\.xml|robots\\.txt|ads\\.txt|manifest\\.json|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|css|js|map)$).*)",
],
```

세 번째 패턴이 negative lookahead 로 `api/` 를 제외 → proxy.ts 의 `rateLimit(request)` 호출이 모든 `/api/*` 에 도달하지 못함. 결과:
- `POST /api/comments` 댓글 스팸 차단 안 됨 (issue #113)
- `/api/search` FULLTEXT 쿼리 보호 안 됨
- `/api/visit` insert 스팸 보호 안 됨
- `/api/og` satori CPU 사용 보호 안 됨

`/api/sync` 는 `SYNC_API_KEY` Bearer token 으로 이미 인증됨 → 제외 유지.

## 결정 (사용자 2026-05-07)

**Option B 채택** — matcher 에서 `api/` 전체 제외 → `api/sync` 만 제외. rateLimit() 시그니처는 변경 없음 (path 별 분기 없이 단일 1000/min/IP 한도 유지).

## 작업 항목

### 1. `src/proxy.ts` matcher 패턴 수정

기존 negative lookahead 의 `api/` 토큰을 `api/sync` 로 정확히 교체:

```ts
matcher: [
  "/",
  "/posts/:path*",
  "/((?!_next/static|_next/image|_next/data|api/sync|favicon|logo|og-default|fonts/|sitemap\\.xml|robots\\.txt|ads\\.txt|manifest\\.json|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|css|js|map)$).*)",
],
```

**핵심 변경**: `api/` → `api/sync`.

다른 negative lookahead 항목은 그대로. 첫 두 라인 (`"/"`, `"/posts/:path*"`) 도 그대로.

### 2. `src/middleware/rateLimit.ts` 변경 없음

기존 동작 유지:
- 1000/min/IP fixed window
- localhost / RFC1918 IP 우회 (관리자 / 내부망)
- 봇 UA (Googlebot/Bingbot/NaverBot/Yeti) 우회
- IP 기반 bucket Map (최대 10000 bucket)

이번 phase 의 본질은 matcher 1줄 변경 — rateLimit.ts 는 손대지 않는다.

### 3. 회귀 테스트 신규 — `src/proxy.test.ts`

이미 있으면 케이스 추가, 없으면 신규 생성:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { proxy } from "./proxy";
import { NextRequest } from "next/server";

// rateLimit 의 부수효과 (Map state) 격리 위해 매 케이스마다 모듈 재import 또는 mock
vi.mock("@/middleware/rateLimit", () => ({
  rateLimit: vi.fn(() => null),
}));
vi.mock("@/middleware/visit", () => ({
  trackVisit: vi.fn(),
}));

import { rateLimit } from "@/middleware/rateLimit";

describe("proxy matcher coverage", () => {
  beforeEach(() => {
    vi.mocked(rateLimit).mockClear();
  });

  it("호출됨 — POST /api/comments (rate limit 적용 대상)", () => {
    // matcher 는 next.js 가 평가 — 단위 테스트는 proxy() 가 호출됐을 때 rateLimit 가 호출되는지 만 검증
    const req = new NextRequest("https://blog.fosworld.co.kr/api/comments", { method: "POST" });
    proxy(req, {} as never);
    expect(rateLimit).toHaveBeenCalled();
  });

  it("호출됨 — /api/search", () => { /* 동일 패턴 */ });
  it("호출됨 — /api/visit", () => { /* 동일 패턴 */ });
  it("호출됨 — /api/og/posts/foo", () => { /* 동일 패턴 */ });

  // matcher pattern 자체 검증 — config.matcher 에 api/sync 포함, api/ 미포함
  it("config.matcher 가 api/sync 만 제외, api/ 전체 제외 아님", () => {
    const { config } = require("./proxy");
    const pattern = String(config.matcher.find((m: string) => m.includes("(?!")) ?? "");
    expect(pattern).toContain("api/sync");
    expect(pattern).not.toMatch(/[|(]api\/[|)]/); // "api/" 단독 토큰 부재
  });
});
```

**중요**: `config.matcher` 는 Next.js routing 레이어 평가 — **단위 테스트로 매칭 자체를 검증할 수 없다**. 위 마지막 테스트는 패턴 문자열 정합성만 확인. matcher 실제 동작은 e2e/manual smoke 로 검증.

수동 smoke (사용자 안내):
```bash
# rate limit 동작 확인 — 1001 회 요청 시 429
for i in $(seq 1 1001); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/comments \
    -H "Content-Type: application/json" \
    -d '{"postSlug":"x","nickname":"y","password":"1234","content":"z"}' &
done | sort | uniq -c
# 기대: 1000 × 200 + 1 × 429 (또는 validation 에러 동일 수치)
# 단 localhost IP 면 우회되므로 외부 IP 시뮬레이션 필요 — X-Forwarded-For 헤더 추가
```

### 4. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

grep -n "api/sync" src/proxy.ts        # 1줄
! grep -nE 'api/[|)]' src/proxy.ts     # api/ 단독 토큰 부재
test -f src/proxy.test.ts || grep -n "api/sync" src/proxy.test.ts
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/proxy.ts` | 수정 (matcher 1 토큰) |
| `src/proxy.test.ts` | 신규 또는 케이스 추가 |

## Out of Scope

- rateLimit.ts 의 path-aware 분기 (option B 결정으로 OOS)
- `/api/search` 별도 엄격 한도 (OOS — 후속 plan 후보)
- nginx / Cloudflare 단 글로벌 한도 (Option D — 인프라 영역)
- Comments API 스팸 패턴 별도 분석 (예: 같은 IP 의 burst 검출)

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| matcher 변경으로 정상 페이지 navigation 도 rate limit 에 영향 | 기존 동작 — 페이지 (/, /posts/*) 는 이미 rate limit 적용 중. 이번 변경은 `/api/*` 에 추가 적용일 뿐 |
| `/api/visit` 가 매 페이지 호출 → 1000/min 빠르게 소진 | 일반 사용자가 1분에 1000 페이지 접근은 비현실 — 한도 적정. RFC1918 / 봇 UA 우회 로직 그대로 작동 |
| 테스트 모킹이 실제 matcher 동작 미검증 | 한계 명시 — 매뉴얼 smoke 로 보완. e2e 테스트는 별도 plan |
| 사이트 운영자 (jon890) 본인이 댓글 작성 시 한도 차단 | RFC1918 / localhost 우회 가능 — 외부 접근 시는 1000/min 한도 안에 들어감. 일반 사용 영향 없음 |
