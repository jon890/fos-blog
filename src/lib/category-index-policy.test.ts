import { describe, expect, it } from "vitest";
import {
  CATEGORY_INDEX_MIN_DIRECT_POSTS,
  CATEGORY_INDEX_MIN_README_BYTES,
  isCategoryIndexable,
} from "./category-index-policy";

describe("isCategoryIndexable", () => {
  it("README가 임계 이상이면 직속 글이 없어도 색인한다", () => {
    expect(
      isCategoryIndexable({
        readmeLength: CATEGORY_INDEX_MIN_README_BYTES,
        directPostCount: 0,
      }),
    ).toBe(true);
  });

  it("직속 글이 임계 이상이면 README가 없어도 색인한다", () => {
    expect(
      isCategoryIndexable({
        readmeLength: 0,
        directPostCount: CATEGORY_INDEX_MIN_DIRECT_POSTS,
      }),
    ).toBe(true);
  });

  it("두 기준이 모두 임계 미만이면 색인하지 않는다", () => {
    expect(
      isCategoryIndexable({
        readmeLength: CATEGORY_INDEX_MIN_README_BYTES - 1,
        directPostCount: CATEGORY_INDEX_MIN_DIRECT_POSTS - 1,
      }),
    ).toBe(false);
  });

  it("임계 직전과 임계값을 구분한다", () => {
    expect(
      isCategoryIndexable({
        readmeLength: CATEGORY_INDEX_MIN_README_BYTES - 1,
        directPostCount: CATEGORY_INDEX_MIN_DIRECT_POSTS - 1,
      }),
    ).toBe(false);
    expect(
      isCategoryIndexable({
        readmeLength: CATEGORY_INDEX_MIN_README_BYTES,
        directPostCount: CATEGORY_INDEX_MIN_DIRECT_POSTS - 1,
      }),
    ).toBe(true);
    expect(
      isCategoryIndexable({
        readmeLength: CATEGORY_INDEX_MIN_README_BYTES - 1,
        directPostCount: CATEGORY_INDEX_MIN_DIRECT_POSTS,
      }),
    ).toBe(true);
  });
});
