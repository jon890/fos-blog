import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("plan035 모바일 가독성 룰 회귀 가드", () => {
  const css = readFileSync(join(__dirname, "../app/globals.css"), "utf-8");
  const components = readFileSync(
    join(__dirname, "markdown/components.tsx"),
    "utf-8"
  );

  it("inline code 에 word-break: keep-all 룰 존재 (#136)", () => {
    expect(css).toMatch(/word-break:\s*keep-all/);
  });

  it("inline code 에 overflow-wrap: anywhere 룰 존재 (#136 fallback)", () => {
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it("코드 블록 pre 에 overflow-x: auto 룰 존재 (#138)", () => {
    expect(css).toMatch(/\.code-card-body pre[\s\S]*?overflow-x:\s*auto/);
  });

  it("테이블 override 가 overflow-x-auto wrapper 사용 (#137)", () => {
    expect(components).toMatch(/overflow-x-auto/);
  });

  it("테이블 override 가 min-w-[32rem] 명시 (#137)", () => {
    expect(components).toMatch(/min-w-\[32rem\]/);
  });
});
