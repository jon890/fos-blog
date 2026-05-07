import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatRelativeTime } from "./format-time";

describe("formatRelativeTime", () => {
  const NOW = new Date("2026-05-07T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 방금 전 for under 1 minute", () => {
    expect(formatRelativeTime(new Date(NOW - 30_000))).toBe("방금 전");
  });

  it("returns N분 전 for 1-59 minutes", () => {
    expect(formatRelativeTime(new Date(NOW - 60_000))).toBe("1분 전");
    expect(formatRelativeTime(new Date(NOW - 59 * 60_000))).toBe("59분 전");
  });

  it("returns N시간 전 at exactly 60 minutes and within 24 hours", () => {
    expect(formatRelativeTime(new Date(NOW - 90 * 60_000))).toBe("1시간 전");
    expect(formatRelativeTime(new Date(NOW - 23 * 3600_000))).toBe("23시간 전");
  });

  it("returns N일 전 for 1-6 days", () => {
    expect(formatRelativeTime(new Date(NOW - 24 * 3600_000))).toBe("1일 전");
    expect(formatRelativeTime(new Date(NOW - 6 * 24 * 3600_000))).toBe("6일 전");
  });

  it("falls back to localized date for 7+ days", () => {
    const result = formatRelativeTime(new Date(NOW - 7 * 24 * 3600_000));
    expect(result).not.toBe("7일 전");
    expect(result.length).toBeGreaterThan(0);
  });

  it("accepts ISO string input (Drizzle JSON serialization)", () => {
    expect(formatRelativeTime(new Date(NOW - 60_000).toISOString())).toBe("1분 전");
  });

  it("returns empty string for invalid date string", () => {
    expect(formatRelativeTime("not-a-date")).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(formatRelativeTime("")).toBe("");
  });
});
