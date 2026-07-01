import { describe, it, expect } from "vitest";
import {
  isKnownCategoryKey,
  toCanonicalCategory,
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
  it('returns 220 for "react"', () => {
    expect(getCategoryHue("react")).toBe(220);
  });

  it('returns 55 for "database" (db hue)', () => {
    expect(getCategoryHue("database")).toBe(55);
  });

  it('returns 285 for "AI/RAG" (AI hue)', () => {
    expect(getCategoryHue("AI/RAG")).toBe(285);
  });
});

describe("getCategoryColor", () => {
  it('returns exact oklch string for "AI"', () => {
    expect(getCategoryColor("AI")).toBe("oklch(0.74 0.09 285)");
  });
});
