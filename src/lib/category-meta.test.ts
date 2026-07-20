import { describe, it, expect } from "vitest";
import {
  isKnownCategoryKey,
  toCanonicalCategory,
  getCategoryLabel,
  getCategoryHue,
  getCategoryColor,
} from "./category-meta";

describe("toCanonicalCategory", () => {
  it('maps "AI" → "ai"', () => {
    expect(toCanonicalCategory("AI")).toBe("ai");
  });

  it('maps "javascript" → "js"', () => {
    expect(toCanonicalCategory("javascript")).toBe("js");
  });

  it('maps "html" → "js"', () => {
    expect(toCanonicalCategory("html")).toBe("js");
  });

  it('maps "redis" → "db"', () => {
    expect(toCanonicalCategory("redis")).toBe("db");
  });

  it('maps "AI/RAG" → "ai" using top-level fallback', () => {
    expect(toCanonicalCategory("AI/RAG")).toBe("ai");
  });

  it('maps "database/opensearch" → "db" using top-level fallback', () => {
    expect(toCanonicalCategory("database/opensearch")).toBe("db");
  });

  it('maps "architecture" → "system" (default)', () => {
    expect(toCanonicalCategory("architecture")).toBe("system");
  });

  it('maps "network" → "system"', () => {
    expect(toCanonicalCategory("network")).toBe("system");
  });

  it('maps "기술공유" → "system"', () => {
    expect(toCanonicalCategory("기술공유")).toBe("system");
  });

  it('maps unknown key → "system"', () => {
    expect(toCanonicalCategory("totally-unknown-key")).toBe("system");
  });
});

describe("isKnownCategoryKey", () => {
  it("returns true for known top-level slash paths", () => {
    expect(isKnownCategoryKey("AI/RAG")).toBe(true);
    expect(isKnownCategoryKey("database/opensearch")).toBe(true);
  });

  it("returns false for unknown slash paths", () => {
    expect(isKnownCategoryKey("unknown/path")).toBe(false);
  });
});

describe("getCategoryHue", () => {
  it("기존 category의 hue를 유지한다", () => {
    expect(getCategoryHue("AI")).toBe(285);
    expect(getCategoryHue("database")).toBe(55);
    expect(getCategoryHue("javascript")).toBe(90);
  });

  it('returns 220 for "react"', () => {
    expect(getCategoryHue("react")).toBe(220);
  });

  it('returns 55 for "database" (db hue)', () => {
    expect(getCategoryHue("database")).toBe(55);
  });

  it('returns 285 for "AI/RAG" (AI hue)', () => {
    expect(getCategoryHue("AI/RAG")).toBe(285);
  });

  it("미등록 category와 하위 path는 같은 안정적 hue를 사용한다", () => {
    const blockchainHue = getCategoryHue("blockchain");
    const quantumHue = getCategoryHue("quantum");

    expect(blockchainHue).toBeGreaterThanOrEqual(0);
    expect(blockchainHue).toBeLessThan(360);
    expect(getCategoryHue("blockchain")).toBe(blockchainHue);
    expect(getCategoryHue("blockchain/evm")).toBe(blockchainHue);
    expect(quantumHue).toBeGreaterThanOrEqual(0);
    expect(quantumHue).toBeLessThan(360);
    expect(getCategoryHue("quantum")).toBe(quantumHue);
  });
});

describe("getCategoryLabel", () => {
  it("기존 category의 canonical label을 유지한다", () => {
    expect(getCategoryLabel("AI")).toBe("ai");
    expect(getCategoryLabel("database")).toBe("db");
    expect(getCategoryLabel("javascript")).toBe("js");
  });

  it("미등록 category는 trim한 원래 key를 표시한다", () => {
    expect(getCategoryLabel(" blockchain ")).toBe("blockchain");
    expect(getCategoryLabel("blockchain/evm")).toBe("blockchain/evm");
  });

  it("빈 key는 기존 안전 대체값을 사용한다", () => {
    expect(getCategoryLabel("   ")).toBe("system");
    expect(getCategoryHue("   ")).toBe(250);
  });
});

describe("getCategoryColor", () => {
  it('returns exact oklch string for "AI"', () => {
    expect(getCategoryColor("AI")).toBe("oklch(0.74 0.09 285)");
  });
});
