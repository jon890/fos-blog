## ADR-016. Rate Limiting — Next.js middleware in-memory fixed window

**Context**: 외부 다량 요청으로 홈서버 자원 고갈 사고. NPM `limit_req` 미설정 + 앱 레벨 보호 부재.

**Decision**:
- Fixed window 60초/IP, 분당 **1000 요청** (PR #76 hotfix 완화 + plan007-2 본질 fix)
- **우회 대상**:
  - localhost: `127.x.x.x`, `::1`, `::ffff:127.x.x.x`, `"localhost"`
  - RFC1918 사설 대역: `10.0.0.0/8`, `172.16-31.x.x`, `192.168.0.0/16` (+ IPv4-mapped IPv6 형태)
  - IPv6 ULA: `fc00::/7`
  - 정상 봇 UA: `Googlebot|Bingbot|NaverBot|Yeti` (Google + Microsoft + Naver SEO)
- proxy.ts matcher 는 HTML navigation 만 카운트 — `/_next/data` (RSC payload), `/api/*`, root 정적 파일(`*.png|css|js|...`), `sitemap.xml|robots.txt|ads.txt|manifest.json` 모두 제외
- **위치**: `src/middleware/rateLimit.ts` — 홈서버 1 인스턴스, in-memory `Map`. NJS16 proxy 는 Node 고정이라 별도 runtime 명시 불필요
- **메모리 가드**: `buckets.size >= 10_000` 시 만료 windowKey 엔트리 일괄 sweep

**Why**: 외부 의존 0 + 1 인스턴스 충분. Redis/Sliding window 기각(over-engineering). matcher 를 HTML 요청 한정으로 좁혀 한 페이지 navigation = 1 카운트로 축소. LAN 내 접속(운영자/가족) 자연 우회 의도. 한국 SEO 핵심 봇(Yeti) 인덱싱 보장 의도. 메모리 가드는 장기 IP 다양성 누적 OOM 방지 — sweep 기준이 windowKey 만료라 활성 IP 카운트는 보존.
