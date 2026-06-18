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

  describe("README → /category 라우팅 (이슈 #178)", () => {
    it("상대경로 하위 폴더 README → /category", () => {
      expect(
        resolveMarkdownLink("./mysql/README.md", "database/README.md")
      ).toBe("/category/database/mysql");
    });

    it("상대경로 상위 이동 README → /category (일반 글 → README 케이스)", () => {
      expect(
        resolveMarkdownLink("../java/opentelemetry/README.md", "architecture/observability-basics.md")
      ).toBe("/category/java/opentelemetry");
    });

    it("README → 다른 폴더 README 인덱스 링크 (README → README 케이스)", () => {
      expect(
        resolveMarkdownLink("../RAG/README.md", "AI/agent/multi-turn-memory-healthcare-agent.md")
      ).toBe("/category/AI/RAG");
    });

    it("같은 디렉토리 ./README.md → 자기 폴더 카테고리", () => {
      expect(
        resolveMarkdownLink("./README.md", "database/mysql/README.md")
      ).toBe("/category/database/mysql");
    });

    it("절대경로 README → /category", () => {
      expect(
        resolveMarkdownLink("/database/mysql/README.md", "database/README.md")
      ).toBe("/category/database/mysql");
    });

    it("README 링크에 앵커가 있으면 보존한다", () => {
      expect(
        resolveMarkdownLink("./mysql/README.md#설치", "database/README.md")
      ).toBe("/category/database/mysql#설치");
    });

    it(".mdx README 도 /category 로 보낸다", () => {
      expect(
        resolveMarkdownLink("./guide/README.mdx", "docs/README.md")
      ).toBe("/category/docs/guide");
    });

    it("소문자 readme.md 도 대소문자 무시하고 /category 로 보낸다", () => {
      expect(
        resolveMarkdownLink("./mysql/readme.md", "database/README.md")
      ).toBe("/category/database/mysql");
    });
  });

  describe("README 방어 — 잘못 매치되면 안 되는 케이스", () => {
    it("README 로 시작만 하는 파일명은 글로 취급 (/posts 유지)", () => {
      expect(
        resolveMarkdownLink("./README-notes.md", "database/README.md")
      ).toBe("/posts/database/README-notes.md");
    });

    it("README 가 파일명이 아닌 폴더명 중간 세그먼트면 글로 취급", () => {
      // 마지막 세그먼트(post.md)가 README 가 아니므로 /posts
      expect(
        resolveMarkdownLink("/java/post.md", "java/README.md")
      ).toBe("/posts/java/post.md");
    });
  });

  describe("최상위 README 방어 (폴더 빈 문자열)", () => {
    it("절대경로 /README.md → /categories (목록)", () => {
      expect(
        resolveMarkdownLink("/README.md", "java/README.md")
      ).toBe("/categories");
    });

    it("최상위에서 ./README.md → /categories", () => {
      expect(
        resolveMarkdownLink("./README.md", "README.md")
      ).toBe("/categories");
    });

    it("최상위 README 링크에 앵커가 있으면 /categories 에 보존", () => {
      expect(
        resolveMarkdownLink("/README.md#intro", "java/README.md")
      ).toBe("/categories#intro");
    });
  });
});
