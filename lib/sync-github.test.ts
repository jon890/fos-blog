import { describe, expect, it } from "vitest";
import { shouldSyncFile } from "./sync-github";

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
