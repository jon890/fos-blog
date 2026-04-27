import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("returns single class unchanged", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("joins multiple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters falsy values (clsx behavior)", () => {
    expect(cn("foo", false, null, undefined, "", "bar")).toBe("foo bar");
  });

  it("supports conditional object syntax (clsx)", () => {
    expect(cn("foo", { bar: true, baz: false })).toBe("foo bar");
  });

  it("flattens nested arrays (clsx)", () => {
    expect(cn(["foo", ["bar", "baz"]])).toBe("foo bar baz");
  });

  it("merges conflicting Tailwind classes — last wins (twMerge)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("preserves non-conflicting Tailwind classes", () => {
    expect(cn("p-2", "m-4", "text-red-500")).toBe("p-2 m-4 text-red-500");
  });

  it("merges responsive variants (twMerge)", () => {
    expect(cn("p-2 md:p-4", "md:p-8")).toBe("p-2 md:p-8");
  });

  it("returns empty string with no inputs", () => {
    expect(cn()).toBe("");
  });
});
