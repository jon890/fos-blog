import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

function makeRequest(
  ip?: string,
  ua?: string,
  url = "http://localhost/"
): NextRequest {
  const headers: Record<string, string> = {};
  if (ip) headers["x-forwarded-for"] = ip;
  if (ua) headers["user-agent"] = ua;
  return new NextRequest(url, { headers });
}

describe("rateLimit — fixed window", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
    await vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("첫 요청은 null 반환 (통과)", async () => {
    const { rateLimit } = await import("./rateLimit");
    const req = makeRequest("1.2.3.4");
    expect(rateLimit(req)).toBeNull();
  });

  it("한도 마지막 요청까지 null 반환", async () => {
    const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
    const req = makeRequest("1.2.3.4");
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW - 1; i++) rateLimit(req);
    expect(rateLimit(req)).toBeNull(); // 한도와 같은 번째 — 통과
  });

  it("한도 초과 요청은 429 반환 + Retry-After 헤더", async () => {
    const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
    const req = makeRequest("1.2.3.4");
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) rateLimit(req);
    const res = rateLimit(req); // (한도+1) 번째
    expect(res).not.toBeNull();
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBeTruthy();
    const retryAfter = Number(res?.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("윈도우 경계 통과 시 새 windowKey 로 count 리셋", async () => {
    const { rateLimit, MAX_REQUESTS_PER_WINDOW, WINDOW_MS } = await import(
      "./rateLimit"
    );
    const req = makeRequest("1.2.3.4");
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) rateLimit(req);
    expect(rateLimit(req)?.status).toBe(429); // 한도 초과 — 차단

    // WINDOW_MS 진행 → 새 윈도우
    vi.advanceTimersByTime(WINDOW_MS);
    expect(rateLimit(req)).toBeNull(); // 새 윈도우 첫 요청 — 통과
  });

  it("Googlebot UA 는 항상 null", async () => {
    const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
    // 한도보다 많이 요청해도 모두 통과
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW + 10; i++) {
      expect(
        rateLimit(
          makeRequest(
            "1.2.3.4",
            "Mozilla/5.0 (compatible; Googlebot/2.1)"
          )
        )
      ).toBeNull();
    }
  });

  it("localhost 127.0.0.1 은 항상 null", async () => {
    const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW + 10; i++) {
      expect(rateLimit(makeRequest("127.0.0.1"))).toBeNull();
    }
  });

  it("localhost ::1 은 항상 null", async () => {
    const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW + 10; i++) {
      expect(rateLimit(makeRequest("::1"))).toBeNull();
    }
  });

  it("IP 헤더 없음(unknown) 은 null", async () => {
    const { rateLimit } = await import("./rateLimit");
    expect(rateLimit(makeRequest())).toBeNull();
  });

  it("다른 IP 는 독립 카운트", async () => {
    const { rateLimit, MAX_REQUESTS_PER_WINDOW } = await import("./rateLimit");
    const reqA = makeRequest("1.1.1.1");
    const reqB = makeRequest("2.2.2.2");
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) rateLimit(reqA);
    expect(rateLimit(reqA)?.status).toBe(429); // A 차단
    expect(rateLimit(reqB)).toBeNull(); // B 독립 — 통과
  });
});

describe("rateLimit — 메모리 가드 (MAX_BUCKETS sweep)", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
    await vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("MAX_BUCKETS 도달 후 새 windowKey 진입 시 만료 entry sweep + 활성 entry 보존", async () => {
    const { rateLimit, MAX_BUCKETS, MAX_REQUESTS_PER_WINDOW, WINDOW_MS } =
      await import("./rateLimit");

    // MAX_BUCKETS 개 IP 를 현재 윈도우에서 채움
    for (let i = 0; i < MAX_BUCKETS; i++) {
      const ip = `10.${Math.floor(i / 65536)}.${Math.floor((i % 65536) / 256)}.${i % 256}`;
      rateLimit(makeRequest(ip));
    }

    // 새 windowKey 로 이동
    vi.advanceTimersByTime(WINDOW_MS);

    // 새 IP 추가 — sweep 트리거 + 새 entry 생성
    const newIp = "99.99.99.99";
    expect(rateLimit(makeRequest(newIp))).toBeNull();

    // 새 IP 는 새 윈도우에서 독립 카운트 시작 — 한도까지 통과
    // 첫 호출(위 expect)에서 count=1, 여기서 (한도-2) 번 더 호출 → count=한도-1
    for (let i = 1; i < MAX_REQUESTS_PER_WINDOW - 1; i++) {
      rateLimit(makeRequest(newIp));
    }
    expect(rateLimit(makeRequest(newIp))).toBeNull(); // 한도 번째 — 통과
    expect(rateLimit(makeRequest(newIp))?.status).toBe(429); // 한도 초과 — 차단
  });
});
