import { describe, expect, it } from "vitest";
import { shouldSyncFile, rewriteImagePaths } from "./sync-github";

describe("shouldSyncFile", () => {
  // ===== 정상 동기화 대상 =====
  it("일반 .md 파일은 동기화한다", () => {
    expect(shouldSyncFile("javascript/closure.md")).toBe(true);
  });

  it("일반 .mdx 파일은 동기화한다", () => {
    expect(shouldSyncFile("react/hooks.mdx")).toBe(true);
  });

  it("중첩 폴더의 .md 파일은 동기화한다", () => {
    expect(shouldSyncFile("java/spring/boot/getting-started.md")).toBe(true);
  });

  it("루트 레벨 .md 파일은 동기화한다", () => {
    expect(shouldSyncFile("intro.md")).toBe(true);
  });

  // ===== 확장자 필터 =====
  it(".md / .mdx 이외 파일은 동기화하지 않는다", () => {
    expect(shouldSyncFile("javascript/index.ts")).toBe(false);
    expect(shouldSyncFile("README.txt")).toBe(false);
    expect(shouldSyncFile("image.png")).toBe(false);
  });

  // ===== 숨김 경로 필터 (.으로 시작하는 폴더/파일) =====
  it(".claude 폴더의 파일은 동기화하지 않는다", () => {
    expect(shouldSyncFile(".claude/skills/deploy.md")).toBe(false);
  });

  it(".gemini 폴더의 파일은 동기화하지 않는다", () => {
    expect(shouldSyncFile(".gemini/context.md")).toBe(false);
  });

  it(".github 폴더의 파일은 동기화하지 않는다", () => {
    expect(shouldSyncFile(".github/PULL_REQUEST_TEMPLATE.md")).toBe(false);
  });

  it("중첩 경로 중간에 숨김 폴더가 있으면 동기화하지 않는다", () => {
    expect(shouldSyncFile("docs/.hidden/note.md")).toBe(false);
  });

  it("숨김 파일(.으로 시작)은 동기화하지 않는다", () => {
    expect(shouldSyncFile("docs/.secret.md")).toBe(false);
  });

  // ===== AI 에이전트 컨텍스트 파일 필터 =====
  it("AGENTS.md는 동기화하지 않는다", () => {
    expect(shouldSyncFile("AGENTS.md")).toBe(false);
    expect(shouldSyncFile("java/AGENTS.md")).toBe(false);
  });

  it("CLAUDE.md는 동기화하지 않는다", () => {
    expect(shouldSyncFile("CLAUDE.md")).toBe(false);
    expect(shouldSyncFile("project/CLAUDE.md")).toBe(false);
  });

  it("GEMINI.md는 동기화하지 않는다", () => {
    expect(shouldSyncFile("GEMINI.md")).toBe(false);
  });

  it("COPILOT.md는 동기화하지 않는다", () => {
    expect(shouldSyncFile("COPILOT.md")).toBe(false);
  });

  it("CURSOR.md는 동기화하지 않는다", () => {
    expect(shouldSyncFile("CURSOR.md")).toBe(false);
  });

  it("에이전트 컨텍스트 파일명은 대소문자 무관하게 필터링한다", () => {
    expect(shouldSyncFile("agents.md")).toBe(false);
    expect(shouldSyncFile("Agents.md")).toBe(false);
    expect(shouldSyncFile("claude.md")).toBe(false);
    expect(shouldSyncFile("Claude.MD")).toBe(false);
  });
});

describe("rewriteImagePaths", () => {
  const BASE = "https://raw.githubusercontent.com/jon889/fos-study/main";

  // ===== 마크다운 이미지 문법 =====
  it("./images/ 상대경로를 GitHub raw URL로 변환한다", () => {
    const content = "![alt](./images/foo.png)";
    const result = rewriteImagePaths(content, "AI/RAG/storm-parse.md");
    expect(result).toBe(`![alt](${BASE}/AI/RAG/images/foo.png)`);
  });

  it("images/ 접두사 없는 상대경로도 변환한다", () => {
    const content = "![실록](fe-silok.png)";
    const result = rewriteImagePaths(content, "AI/RAG/toss-parkssi.md");
    expect(result).toBe(`![실록](${BASE}/AI/RAG/fe-silok.png)`);
  });

  it("../ 상위 디렉토리 상대경로를 올바르게 변환한다", () => {
    const content = "![alt](../shared/banner.png)";
    const result = rewriteImagePaths(content, "devops/k8s/pods.md");
    expect(result).toBe(`![alt](${BASE}/devops/shared/banner.png)`);
  });

  it("루트 레벨 파일의 상대경로를 변환한다", () => {
    const content = "![alt](./images/intro.png)";
    const result = rewriteImagePaths(content, "intro.md");
    expect(result).toBe(`![alt](${BASE}/images/intro.png)`);
  });

  it("이미 절대 URL인 이미지는 변환하지 않는다", () => {
    const content = "![alt](https://example.com/image.png)";
    const result = rewriteImagePaths(content, "AI/RAG/doc.md");
    expect(result).toBe(content);
  });

  it("http:// URL도 변환하지 않는다", () => {
    const content = "![alt](http://example.com/image.png)";
    const result = rewriteImagePaths(content, "AI/RAG/doc.md");
    expect(result).toBe(content);
  });

  it("이미지가 없는 콘텐츠는 그대로 반환한다", () => {
    const content = "# 제목\n\n일반 텍스트입니다.";
    const result = rewriteImagePaths(content, "java/spring.md");
    expect(result).toBe(content);
  });

  it("본문에 여러 이미지가 있으면 모두 변환한다", () => {
    const content = [
      "![img1](./images/a.png)",
      "텍스트",
      "![img2](./images/b.webp)",
    ].join("\n");
    const result = rewriteImagePaths(content, "devops/k8s-in-action/pods.md");
    expect(result).toContain(`${BASE}/devops/k8s-in-action/images/a.png`);
    expect(result).toContain(`${BASE}/devops/k8s-in-action/images/b.webp`);
  });

  // ===== HTML img 태그 =====
  it("HTML img 태그의 상대경로도 변환한다", () => {
    const content = `<img src="./images/diagram.png" alt="diagram">`;
    const result = rewriteImagePaths(content, "database/design/erd.md");
    expect(result).toBe(
      `<img src="${BASE}/database/design/images/diagram.png" alt="diagram">`
    );
  });

  it("HTML img 태그의 절대 URL은 변환하지 않는다", () => {
    const content = `<img src="https://example.com/img.png" alt="x">`;
    const result = rewriteImagePaths(content, "database/design/erd.md");
    expect(result).toBe(content);
  });
});
