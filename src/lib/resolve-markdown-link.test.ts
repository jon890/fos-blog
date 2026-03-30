import { describe, expect, it } from "vitest";
import { resolveMarkdownLink } from "./resolve-markdown-link";

describe("resolveMarkdownLink", () => {
  describe("절대경로 (/로 시작)", () => {
    it("루트 절대경로를 /posts/ URL로 변환한다 (.md 유지)", () => {
      expect(
        resolveMarkdownLink("/java/spring-batch/0.1-introduce.md", "java/spring-batch/README.md")
      ).toBe("/posts/java/spring-batch/0.1-introduce.md");
    });

    it("절대경로에 앵커가 포함된 경우 유지한다", () => {
      expect(
        resolveMarkdownLink("/java/spring-batch/post.md#section", "java/spring-batch/README.md")
      ).toBe("/posts/java/spring-batch/post.md#section");
    });

    it(".mdx 확장자도 유지한다", () => {
      expect(
        resolveMarkdownLink("/java/post.mdx", "java/README.md")
      ).toBe("/posts/java/post.mdx");
    });
  });

  describe("상대경로 (같은 디렉토리)", () => {
    it("./로 시작하는 링크를 변환한다 (.md 유지)", () => {
      expect(
        resolveMarkdownLink("./other.md", "AI/RAG/embedding.md")
      ).toBe("/posts/AI/RAG/other.md");
    });

    it("확장자 없이 파일명만 있는 링크를 변환한다 (async-item-processor.md 패턴)", () => {
      expect(
        resolveMarkdownLink("async-item-processor.md", "java/spring-batch/README.md")
      ).toBe("/posts/java/spring-batch/async-item-processor.md");
    });

    it("같은 디렉토리 링크에 앵커가 포함된 경우 유지한다", () => {
      expect(
        resolveMarkdownLink("./post.md#heading", "AI/RAG/embedding.md")
      ).toBe("/posts/AI/RAG/post.md#heading");
    });
  });

  describe("상대경로 (상위 디렉토리)", () => {
    it("../로 한 단계 상위 디렉토리로 이동한다", () => {
      expect(
        resolveMarkdownLink("../intro.md", "AI/RAG/embedding.md")
      ).toBe("/posts/AI/intro.md");
    });

    it("../로 다른 하위 디렉토리로 이동한다", () => {
      expect(
        resolveMarkdownLink("../NLP/tokenizer.md", "AI/RAG/embedding.md")
      ).toBe("/posts/AI/NLP/tokenizer.md");
    });

    it("../../로 두 단계 상위 디렉토리로 이동한다", () => {
      expect(
        resolveMarkdownLink("../../Other/post.md", "AI/RAG/embedding.md")
      ).toBe("/posts/Other/post.md");
    });

    it("상위 이동에 앵커가 포함된 경우 유지한다", () => {
      expect(
        resolveMarkdownLink("../NLP/tokenizer.md#section", "AI/RAG/embedding.md")
      ).toBe("/posts/AI/NLP/tokenizer.md#section");
    });
  });

  describe("폴더 README 기준 링크 (실제 spring-batch 케이스)", () => {
    it("README에서 절대경로 .md 링크를 변환한다", () => {
      expect(
        resolveMarkdownLink("/java/spring-batch/1.1-type-of-steps.md", "java/spring-batch/README.md")
      ).toBe("/posts/java/spring-batch/1.1-type-of-steps.md");
    });

    it("README에서 상대경로 .md 링크를 변환한다", () => {
      expect(
        resolveMarkdownLink("async-item-processor.md", "java/spring-batch/README.md")
      ).toBe("/posts/java/spring-batch/async-item-processor.md");
    });
  });

  describe("task/nsc-slot/README.md 케이스", () => {
    it("README.md에서 같은 디렉토리 링크를 변환한다", () => {
      expect(
        resolveMarkdownLink("./slot-machine.md", "task/nsc-slot/README.md")
      ).toBe("/posts/task/nsc-slot/slot-machine.md");
    });

    it("README.md에서 절대경로 링크를 변환한다", () => {
      expect(
        resolveMarkdownLink("/task/nsc-slot/slot-machine.md", "task/nsc-slot/README.md")
      ).toBe("/posts/task/nsc-slot/slot-machine.md");
    });
  });
});
