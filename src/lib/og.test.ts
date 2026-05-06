import { describe, it, expect } from "vitest";
import {
  truncateForOg,
  getCategoryHex,
  hexWithAlpha,
  OG_CATEGORY_HEX,
  OG_CATEGORY_DEFAULT_HEX,
} from "./og";

describe("truncateForOg", () => {
  it("returns text unchanged when shorter than max", () => {
    expect(truncateForOg("hello", 10)).toBe("hello");
  });

  it("returns text unchanged when exactly at max length", () => {
    expect(truncateForOg("1234567890", 10)).toBe("1234567890");
  });

  it("truncates and appends ellipsis when exceeding max", () => {
    expect(truncateForOg("12345678901", 10)).toBe("1234567890...");
  });

  it("collapses consecutive whitespace to single space", () => {
    expect(truncateForOg("foo   bar\n\nbaz")).toBe("foo bar baz");
  });

  it("trims leading and trailing whitespace", () => {
    expect(truncateForOg("  hello  ")).toBe("hello");
  });

  it("handles Korean characters by character count (not byte)", () => {
    const input = "가나다라마바사아자차카타파하";
    expect(truncateForOg(input, 5)).toBe("가나다라마...");
  });

  it("trims trailing whitespace before appending ellipsis", () => {
    expect(truncateForOg("hello world extra", 6)).toBe("hello...");
  });

  it("returns empty string when input is all whitespace", () => {
    expect(truncateForOg("   \n\t  ")).toBe("");
  });

  it("uses default max of 120 when not provided", () => {
    const input = "a".repeat(130);
    const result = truncateForOg(input);
    expect(result).toBe("a".repeat(120) + "...");
  });
});

describe("getCategoryHex", () => {
  it("returns OG_CATEGORY_HEX.js for 'js'", () => {
    expect(getCategoryHex("js")).toBe(OG_CATEGORY_HEX.js);
  });

  it("resolves alias: 'javascript' → OG_CATEGORY_HEX.js", () => {
    expect(getCategoryHex("javascript")).toBe(OG_CATEGORY_HEX.js);
  });

  it("resolves alias: 'database' → OG_CATEGORY_HEX.db", () => {
    expect(getCategoryHex("database")).toBe(OG_CATEGORY_HEX.db);
  });

  it("returns OG_CATEGORY_DEFAULT_HEX for unknown category", () => {
    expect(getCategoryHex("UNKNOWN")).toBe(OG_CATEGORY_DEFAULT_HEX);
  });
});

describe("hexWithAlpha", () => {
  it("converts hex to rgba with given alpha", () => {
    expect(hexWithAlpha("#3fbac9", 0.12)).toBe("rgba(63, 186, 201, 0.12)");
  });

  it("falls back to brand teal rgba when hex is malformed", () => {
    expect(hexWithAlpha("not-a-hex", 0.3)).toBe("rgba(63, 186, 201, 0.3)");
    expect(hexWithAlpha("#abc", 0.3)).toBe("rgba(63, 186, 201, 0.3)");
    expect(hexWithAlpha("", 0.3)).toBe("rgba(63, 186, 201, 0.3)");
  });
});
