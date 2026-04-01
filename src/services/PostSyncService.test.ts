import { describe, expect, it } from "vitest";
import { parsePath } from "./PostSyncService";

describe("parsePath", () => {
  it("루트 경로 파일 — category는 확장자 포함 파일명, title은 확장자 제거", () => {
    const result = parsePath("intro.md");
    expect(result.category).toBe("intro.md"); // category: pathParts[0], 확장자 미제거
    expect(result.foldersList).toEqual([]);
    expect(result.subcategory).toBeUndefined();
    expect(result.title).toBe("intro"); // title: pathParts[last], 확장자 제거
  });

  it("1단계 경로 — category와 파일명 분리", () => {
    const result = parsePath("AI/intro.md");
    expect(result.category).toBe("AI");
    expect(result.foldersList).toEqual([]);
    expect(result.subcategory).toBeUndefined();
    expect(result.title).toBe("intro");
  });

  it("2단계 경로 — subcategory는 첫 번째 폴더", () => {
    const result = parsePath("AI/RAG/intro.md");
    expect(result.category).toBe("AI");
    expect(result.foldersList).toEqual(["RAG"]);
    expect(result.subcategory).toBe("RAG");
    expect(result.title).toBe("intro");
  });

  it("3단계 이상 경로 — foldersList에 중간 폴더 모두 포함", () => {
    const result = parsePath("AI/RAG/deep/intro.md");
    expect(result.category).toBe("AI");
    expect(result.foldersList).toEqual(["RAG", "deep"]);
    expect(result.subcategory).toBe("RAG");
    expect(result.title).toBe("intro");
  });

  it("파일명의 언더스코어를 공백으로 변환한다", () => {
    const result = parsePath("AI/hello_world_guide.md");
    expect(result.title).toBe("hello world guide");
  });

  it(".mdx 확장자도 제거한다", () => {
    const result = parsePath("AI/intro.mdx");
    expect(result.title).toBe("intro");
  });

  it("빈 문자열 — category는 uncategorized", () => {
    const result = parsePath("");
    expect(result.category).toBe("uncategorized");
    expect(result.foldersList).toEqual([]);
  });
});
