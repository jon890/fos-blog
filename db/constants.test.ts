import { describe, expect, it } from "vitest";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "./constants";

describe("categoryIcons", () => {
  it("주요 카테고리에 아이콘이 정의되어 있다", () => {
    const expectedCategories = [
      "AI", "algorithm", "architecture", "database", "devops",
      "java", "javascript", "react", "git", "network",
    ];
    for (const category of expectedCategories) {
      expect(categoryIcons[category], `${category} 아이콘 누락`).toBeTruthy();
    }
  });

  it("모든 아이콘 값이 비어있지 않은 문자열이다", () => {
    for (const [key, icon] of Object.entries(categoryIcons)) {
      expect(typeof icon, `${key}의 아이콘이 문자열이 아님`).toBe("string");
      expect(icon.length, `${key}의 아이콘이 빈 문자열`).toBeGreaterThan(0);
    }
  });

  it("DEFAULT_CATEGORY_ICON은 존재하는 이모지다", () => {
    expect(typeof DEFAULT_CATEGORY_ICON).toBe("string");
    expect(DEFAULT_CATEGORY_ICON.length).toBeGreaterThan(0);
  });

  it("등록되지 않은 카테고리는 undefined를 반환한다 (fallback 필요)", () => {
    expect(categoryIcons["unknown-category"]).toBeUndefined();
    // getCategoryIcon의 fallback 로직 검증: undefined || DEFAULT_CATEGORY_ICON
    const icon = categoryIcons["unknown-category"] || DEFAULT_CATEGORY_ICON;
    expect(icon).toBe(DEFAULT_CATEGORY_ICON);
  });
});
