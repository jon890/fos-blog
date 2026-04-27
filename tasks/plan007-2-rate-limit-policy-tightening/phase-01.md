# Phase 01 — matcher 좁히기 + LOCALHOST/RFC1918 우회 + BOT_UA 확장 + 단위 테스트

## 컨텍스트 (자기완결 프롬프트)

plan007 (rate limit 60/min/IP) + hotfix PR #76 (한도 60 → 1000) 머지 완료 전제. PR #76 은 한도만 완화한 응급 처치. 본질 원인 (matcher 광범위 + IPv4-mapped IPv6 미인식 + 정상 봇 차단) 을 정리해 1000 마진을 정상 사용량 안에서 사용.

진단 (사용자 보고 + 코드 분석):
- 한 글 상세 페이지 navigation = HTML + RSC payload (`/_next/data/**`) + `/api/visit` POST + `/api/comments` GET ≈ 4-6 카운트 — 5 페이지 안에 60 한도 도달 가능 (PR #76 의 1000 으로 완화됐지만 본질 미해결)
- LAN 내 접속 (`192.168.x.x` 등) 도 외부 IP 처럼 카운트 — 운영자/가족 LAN 접속도 한도에 합산
- Naver/Bing 등 한국 SEO 핵심 봇 차단 — 인덱싱 영향

scope 외 (별도 plan/issue):
- API path 별 한도 차등 (`/api/visit` 3000, `/api/comments` 60 등) — 사용자 결정 Q4=A (분리 안 함)
- env 기반 운영자 IP allowlist — 사용자 결정 Q5=A (도입 안 함, YAGNI)
- 한도 자체 변경 — PR #76 의 1000 그대로 유지

### 현재 baseline (PR #76 머지 후 상태 — 변경 대상)

`src/proxy.ts`:
```ts
export const config = {
  matcher: [
    "/",
    "/posts/:path*",
    "/((?!_next/static|_next/image|favicon|logo|og-default|fonts/).*)",
  ],
};
```

`src/middleware/rateLimit.ts` (PR #76 후):
```ts
export const WINDOW_MS = 60_000;
export const MAX_REQUESTS_PER_WINDOW = 1000;
export const MAX_BUCKETS = 10_000;
const BOT_UA_PATTERN = /Googlebot/i;
const LOCALHOST_IPS = new Set(["127.0.0.1", "::1"]);
```

### 이 phase 의 핵심 전환 (사용자 결정 Q1~Q5 반영)

1. **matcher 확장 (Q1=B)**: `_next/data` (RSC) + `api` + `sitemap.xml` / `robots.txt` / `ads.txt` / `manifest.json` + 모든 root 이미지 (`.*\.(png|jpg|jpeg|svg|ico|webp|gif)`) 모두 제외 → 한 페이지 navigation = **1 카운트** (HTML 만)
2. **localhost 우회 확장 (Q2=A+B)**: `127.0.0.1` / `::1` / `localhost` / **`::ffff:127.x.x.x`** (IPv4-mapped IPv6) + **RFC1918 사설 대역** (`10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`) + **IPv6 ULA** (`fc00::/7`) → LAN 내 모든 접속 우회
3. **BOT_UA 확장 (Q3=C)**: `Googlebot` + `Bingbot` + `NaverBot|Yeti` (Naver 의 봇은 yeti UA 사용) → 한국 + 영어 SEO 핵심 봇 우회
4. **단위 테스트 신규 케이스**: IPv4-mapped IPv6, RFC1918 각 대역, Naver Yeti, Bingbot 모두 검증

scope 명시 안 한 결정 (자명):
- `unknown` IP 우회 정책 — 그대로 유지 (헤더 없는 환경 — dev / nginx 미설정 시 fail-open)
- 한도 1000 — 그대로 유지
- buckets sweep 정책 — 변경 없음

## 먼저 읽을 문서

- `docs/adr.md` — **ADR-016** (Rate limit 정책)
- `src/proxy.ts` — 현재 matcher
- `src/middleware/rateLimit.ts` — 현재 LOCALHOST_IPS / BOT_UA_PATTERN
- `src/middleware/rateLimit.test.ts` — 기존 9 케이스
- `.claude/skills/_shared/common-critic-patterns.md` — 시드 7 패턴

## 사전 게이트

```bash
# cwd: <worktree root>

# 1) PR #76 (hotfix 1000) 머지 완료 확인
grep -nE "MAX_REQUESTS_PER_WINDOW = 1000" src/middleware/rateLimit.ts
grep -nE "export const WINDOW_MS|export const MAX_REQUESTS|export const MAX_BUCKETS" src/middleware/rateLimit.ts | wc -l  # = 3

# 2) 기존 파일 위치
test -f src/proxy.ts
test -f src/middleware/rateLimit.ts
test -f src/middleware/rateLimit.test.ts

# 3) ADR-016 존재
grep -n "ADR-016" docs/adr.md
```

위 항목 중 어느 하나라도 실패하면 **PHASE_BLOCKED: PR #76 (rate-limit 1000 hotfix) 미머지**.

## 작업 목록 (총 5개)

### 1. `src/proxy.ts` — matcher negative lookahead 확장 (Q1 B)

```ts
export const config = {
  matcher: [
    "/",
    "/posts/:path*",
    "/((?!_next/static|_next/image|_next/data|api/|favicon|logo|og-default|fonts/|sitemap\\.xml|robots\\.txt|ads\\.txt|manifest\\.json|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|css|js|map)$).*)",
  ],
};
```

설계 메모:
- **`_next/data`** — Next.js App Router RSC payload (매 navigation 자동 fetch). 미제외 시 한 페이지 = 2 카운트
- **`api/`** — 자체 API 호출 (`/api/visit`, `/api/comments`, `/api/posts`, `/api/search`, `/api/og`, `/api/sync`) 모두 제외. SYNC_API_KEY 인증은 별도 — rate limit 영향 없음
- **`sitemap.xml`, `robots.txt`, `ads.txt`, `manifest.json`** — 검색엔진/AdSense bot 정기 fetch — 봇 UA 우회와 별개로 path 자체 제외
- **`.*\.(png|...)$`** — root 정적 이미지 (`/og-default.png` 외에도 `/icon.png`, `/apple-touch-icon.png` 등). `_next/image` 변환 안 거친 직접 fetch 제외
- **`.css|.js|.map`** — sourcemap, 직접 노출된 정적 자산 (Next 16 standalone 에서 일부 path 가 `_next/static` 아닌 root 로 노출 가능)
- 정규식 escape: `\\.` (마침표) → matcher 문자열 안에서 `\\.` 두 번 escape

### 2. `src/middleware/rateLimit.ts` — localhost / 사설 대역 / BOT_UA 확장 (Q2 A+B, Q3 C)

기존 `LOCALHOST_IPS Set` 을 함수 기반 `isLocalOrPrivateIp(ip)` 로 교체. `BOT_UA_PATTERN` 확장.

```ts
// NaverBot 은 현재 Yeti UA 만 사용하지만, Naver 가 향후 별도 봇명을 도입할 가능성 대비 future-proofing 으로 유지
const BOT_UA_PATTERN = /Googlebot|Bingbot|NaverBot|Yeti/i;

/**
 * IPv4 또는 IPv6 의 localhost / RFC1918 사설 대역 / IPv6 ULA 여부.
 *
 * 우회 대상:
 * - localhost: 127.x.x.x, ::1, ::ffff:127.x.x.x, "localhost"
 * - RFC1918: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
 * - RFC1918 IPv4-mapped IPv6: ::ffff:10.x.x.x, ::ffff:192.168.x.x, ::ffff:172.16-31.x.x
 * - IPv6 ULA: fc00::/7 (fc.. 또는 fd..)
 */
export function isLocalOrPrivateIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase();
  if (ip === "" || ip === "unknown" || ip === "localhost") return true;
  if (ip === "::1") return true;

  // IPv4-mapped IPv6 → IPv4 부분만 추출
  const v4 = ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;

  // IPv4 인지 확인
  const v4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v4);
  if (v4Match) {
    const a = Number(v4Match[1]);
    const b = Number(v4Match[2]);
    if (a === 127) return true;                     // 127.0.0.0/8 loopback
    if (a === 10) return true;                      // 10.0.0.0/8
    if (a === 192 && b === 168) return true;        // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    return false;
  }

  // IPv6 ULA fc00::/7 — 첫 바이트 fc 또는 fd
  if (/^f[cd][0-9a-f]{2}:/.test(ip)) return true;

  return false;
}
```

기존 `LOCALHOST_IPS` Set 제거 + `rateLimit` 함수의 우회 검사를 함수 호출로 교체:

```ts
// 기존
if (ip === "unknown" || LOCALHOST_IPS.has(ip)) return null;

// 변경
if (isLocalOrPrivateIp(ip)) return null;
```

설계 메모:
- `isLocalOrPrivateIp` 를 export — 단위 테스트 용이성 + 다른 middleware (visit 등) 가 미래에 재사용 가능
- `unknown` 도 우회 (기존 정책 유지) — 헤더 없는 환경 fail-open
- `localhost` literal 도 우회 (Next.js dev 가 가끔 호스트명 그대로 전달)
- 정규식 + 숫자 비교 패턴 — 외부 lib (ipaddr.js 등) 없이 충분

### 3. `src/middleware/rateLimit.test.ts` — 신규 케이스 추가

기존 9 케이스 보존 + 새 케이스 추가:

```ts
it("IPv4-mapped IPv6 localhost (::ffff:127.0.0.1) 은 항상 null", async () => {
  const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
  for (let i = 0; i < MAX_REQUESTS_PER_WINDOW + 10; i++) {
    expect(rateLimit(makeRequest("::ffff:127.0.0.1"))).toBeNull();
  }
});

it("RFC1918 192.168.x.x 우회", async () => {
  const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
  for (let i = 0; i < MAX_REQUESTS_PER_WINDOW + 10; i++) {
    expect(rateLimit(makeRequest("192.168.1.50"))).toBeNull();
  }
});

it("RFC1918 10.x.x.x 우회", async () => {
  const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
  for (let i = 0; i < MAX_REQUESTS_PER_WINDOW + 10; i++) {
    expect(rateLimit(makeRequest("10.0.5.7"))).toBeNull();
  }
});

it("RFC1918 172.16-31.x.x 우회 (172.20.x.x)", async () => {
  const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
  for (let i = 0; i < MAX_REQUESTS_PER_WINDOW + 10; i++) {
    expect(rateLimit(makeRequest("172.20.10.5"))).toBeNull();
  }
});

it("172.16 미만 (172.15.x.x) 은 사설 대역 아님 — 차단됨", async () => {
  const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
  const req = makeRequest("172.15.1.1");
  for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) rateLimit(req);
  expect(rateLimit(req)?.status).toBe(429);
});

it("172.32 이상 (172.32.x.x) 은 사설 대역 아님 — 차단됨", async () => {
  const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
  const req = makeRequest("172.32.1.1");
  for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) rateLimit(req);
  expect(rateLimit(req)?.status).toBe(429);
});

it("Bingbot UA 는 항상 null", async () => {
  const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
  for (let i = 0; i < MAX_REQUESTS_PER_WINDOW + 10; i++) {
    expect(
      rateLimit(makeRequest("1.2.3.4", "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"))
    ).toBeNull();
  }
});

it("NaverBot Yeti UA 는 항상 null", async () => {
  const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
  for (let i = 0; i < MAX_REQUESTS_PER_WINDOW + 10; i++) {
    expect(
      rateLimit(makeRequest("1.2.3.4", "Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)"))
    ).toBeNull();
  }
});

it("isLocalOrPrivateIp 단위 — IPv6 ULA (fc/fd) 우회", async () => {
  const { isLocalOrPrivateIp } = await import("./rateLimit");
  expect(isLocalOrPrivateIp("fc00::1")).toBe(true);
  expect(isLocalOrPrivateIp("fd12:3456:789a::1")).toBe(true);
  expect(isLocalOrPrivateIp("2001:db8::1")).toBe(false);  // global IPv6 — 차단
});

it("isLocalOrPrivateIp 단위 — public IPv4 는 false", async () => {
  const { isLocalOrPrivateIp } = await import("./rateLimit");
  expect(isLocalOrPrivateIp("8.8.8.8")).toBe(false);
  expect(isLocalOrPrivateIp("1.1.1.1")).toBe(false);
  expect(isLocalOrPrivateIp("203.0.113.42")).toBe(false);
});
```

기존 `localhost 127.0.0.1` / `localhost ::1` 케이스도 그대로 통과해야 함 (회귀 방지).

**기존 sweep test IP 회귀 방지 (필수)**: `rateLimit.test.ts` 의 MAX_BUCKETS sweep describe 블록 (현재 L108-144) 의 IP 생성식이 `10.${...}` 형태이면 phase 변경 후 `isLocalOrPrivateIp("10.x.x.x") === true` 가 되어 buckets 등록 자체가 안 됨 → sweep 의 OOM 가드 의미가 silent 하게 사라진다. 다음과 같이 변경:

```ts
// 변경 전 (L125)
const ip = `10.${Math.floor(i / 65536)}.${Math.floor((i % 65536) / 256)}.${i % 256}`;

// 변경 후 — TEST-NET-3 (203.0.113.0/24) 가 too small 이므로 CGN 대역(100.64.0.0/10) 사용
const ip = `100.${64 + Math.floor(i / 65536)}.${Math.floor((i % 65536) / 256)}.${i % 256}`;
```

`100.64.0.0/10` (RFC 6598 CGN 대역) 은 RFC1918/loopback 모두 아님 → `isLocalOrPrivateIp === false`. `newIp = "99.99.99.99"` 도 그대로 유지 (CGN 범위와 충돌 없음).

### 4. ADR-016 갱신 (한도 1000 + 우회 정책 확장)

`docs/adr.md` 의 ADR-016 항목을 phase 변경에 맞춰 갱신. 현재 "localhost(127.0.0.1/::1) 예외" + "Googlebot UA 예외" + 한도 60 으로 기술된 부분을 다음으로 교체:

```md
## ADR-016. Rate limit 정책

**Decision**:
- Fixed window 60초/IP, 분당 **1000 요청** (PR #76 hotfix 완화 + plan007-2 본질 fix)
- **우회 대상**:
  - localhost: `127.x.x.x`, `::1`, `::ffff:127.x.x.x`, `"localhost"`
  - RFC1918 사설 대역: `10.0.0.0/8`, `172.16-31.x.x`, `192.168.0.0/16` (+ IPv4-mapped IPv6 형태)
  - IPv6 ULA: `fc00::/7`
  - 정상 봇 UA: `Googlebot|Bingbot|NaverBot|Yeti` (Google + Microsoft + Naver SEO)
- proxy.ts matcher 는 HTML navigation 만 카운트 — `/_next/data` (RSC payload), `/api/*`, root 정적 파일(`*.png|css|js|...`), `sitemap.xml|robots.txt|ads.txt|manifest.json` 모두 제외
```

자명성 검사: 한도 1000 + 우회 정책 모두 코드에 self-evident → ADR 본문은 "왜" 만 보존 (LAN 내 접속 자연 우회 의도 + 한국 SEO 봇 인덱싱 보장 의도). 수치는 코드 참조.

### 5. 통합 검증

```bash
# cwd: <worktree root>
pnpm test -- --run src/middleware/rateLimit.test.ts
pnpm lint
pnpm type-check
pnpm test -- --run
pnpm build
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) matcher 확장
grep -nE "_next/data" src/proxy.ts
grep -nE "api/" src/proxy.ts
grep -nE "sitemap\\\\.xml" src/proxy.ts
grep -nE "robots\\\\.txt" src/proxy.ts
grep -nE "ads\\\\.txt" src/proxy.ts
grep -nE "manifest\\\\.json" src/proxy.ts
grep -nE "png\\|jpg\\|jpeg\\|svg" src/proxy.ts

# 2) localhost / 사설 대역 우회 함수 신규
grep -n "export function isLocalOrPrivateIp" src/middleware/rateLimit.ts
grep -n "::ffff:" src/middleware/rateLimit.ts
grep -nE "a === 127|a === 10|a === 192" src/middleware/rateLimit.ts
grep -nE "172.*16.*31|b >= 16.*b <= 31" src/middleware/rateLimit.ts
grep -nE "f\\[cd\\]" src/middleware/rateLimit.ts

# 기존 LOCALHOST_IPS Set 제거 (함수로 교체)
! grep -nE "const LOCALHOST_IPS\s*=\s*new Set" src/middleware/rateLimit.ts

# 3) BOT_UA 확장
grep -nE "Googlebot.*Bingbot.*Yeti|Googlebot\\|Bingbot\\|NaverBot\\|Yeti" src/middleware/rateLimit.ts

# 4) 신규 단위 테스트 케이스
grep -n "::ffff:127.0.0.1" src/middleware/rateLimit.test.ts
grep -n "192.168" src/middleware/rateLimit.test.ts
grep -n "10.0.5" src/middleware/rateLimit.test.ts
grep -n "172.20" src/middleware/rateLimit.test.ts
grep -n "Bingbot" src/middleware/rateLimit.test.ts
grep -nE "Yeti|NaverBot" src/middleware/rateLimit.test.ts
grep -n "isLocalOrPrivateIp" src/middleware/rateLimit.test.ts

# sweep test IP 회귀 방지 — 10.x.x.x 사용 금지 (RFC1918 우회 후 buckets 등록 안 됨)
! grep -nE 'const ip = `10\.' src/middleware/rateLimit.test.ts
grep -nE 'const ip = `100\.' src/middleware/rateLimit.test.ts

# 5) ADR-016 갱신
grep -nE "1000.*요청|RFC1918|Bingbot|Yeti" docs/adr.md

# 6) 빌드 + 회귀
pnpm test -- --run
pnpm lint
pnpm type-check
pnpm build

# 7) 금지사항
! grep -nE "as any" src/middleware/rateLimit.ts src/proxy.ts
! grep -nE "console\\.(log|warn|error)" src/middleware/rateLimit.ts src/proxy.ts
```

## PHASE_BLOCKED 조건

- PR #76 미머지 (사전 게이트 1 실패) → **PHASE_BLOCKED: hotfix 머지 후 진행**
- matcher 의 negative lookahead 정규식이 빌드 시 실패 (Next.js 16 의 path-to-regexp 제약) → **PHASE_BLOCKED: matcher 패턴 단순화 (각 path 별도 entry 분리 — `/api/*` 명시 제외 같은 형태)**
- IPv6 표기 정규식 `^f[cd][0-9a-f]{2}:` 가 일부 IPv6 표기 (예: 약식 표기 `fc00::1` vs full `fc00:0000:0000:0000:0000:0000:0000:0001`) 모두 매칭 안 됨 → **PHASE_BLOCKED: 약식/full 둘 다 cover 하도록 정규식 재설계**

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋:
- `feat(proxy): exclude /_next/data + /api + root static from rate limit matcher`
- `feat(rate-limit): expand localhost bypass to RFC1918 + IPv4-mapped IPv6 + IPv6 ULA`
- `feat(rate-limit): expand BOT_UA to Bingbot + NaverBot Yeti (Korean/EN SEO)`
- `test(rate-limit): add cases for IPv4-mapped IPv6 / RFC1918 / Bingbot / Yeti`
- `docs(adr): update ADR-016 — 1000/min + RFC1918 bypass + multi-bot`
