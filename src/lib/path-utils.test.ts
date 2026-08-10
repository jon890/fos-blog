import { describe, expect, it } from "vitest";
import {
  computeFolderPaths,
  normalizeCategoryPathSegments,
} from "./path-utils";

describe("normalizeCategoryPathSegments", () => {
  it("대문자 세그먼트를 소문자로 바꾼다", () => {
    expect(normalizeCategoryPathSegments(["AI"])).toEqual(["ai"]);
  });

  it("이미 소문자인 세그먼트는 그대로 둔다", () => {
    expect(normalizeCategoryPathSegments(["backend"])).toEqual(["backend"]);
  });

  it("여러 단계 경로의 모든 세그먼트를 처리한다", () => {
    expect(normalizeCategoryPathSegments(["AI", "RAG"])).toEqual([
      "ai",
      "rag",
    ]);
  });

  it("빈 배열을 처리한다", () => {
    expect(normalizeCategoryPathSegments([])).toEqual([]);
  });
});

describe("computeFolderPaths", () => {
  it("post 경로에서 중복 없는 중간 폴더 경로를 정렬해 반환한다", () => {
    expect(
      computeFolderPaths(["AI/RAG/intro.md", "AI/basics.md"]),
    ).toEqual([["AI"], ["AI", "RAG"]]);
  });
});
