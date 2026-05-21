import { describe, it, expect } from "vitest";
import { formatDate } from "./date-utils";

describe("formatDate", () => {
  it("returns YYYY.MM.DD with zero padding", () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe("2026.01.05");
    expect(formatDate(new Date(2026, 11, 31))).toBe("2026.12.31");
  });

  it("returns empty string for null / undefined", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
  });

  it("returns empty string for Invalid Date", () => {
    expect(formatDate(new Date("not-a-date"))).toBe("");
  });
});
