import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression guard for plan017/plan012 silent breakage.
 *
 * 사고 경위: MarkdownRenderer 의 wrapper className 이 `prose-sm md:prose ...` 였음.
 * `prose-sm` 와 `md:prose` 는 별개 클래스 — 모바일 (md 미만) 에서는 unconditional
 * `prose` 가 없어 globals.css 의 모든 `.prose .code-card-body ...` 셀렉터가 매칭
 * 실패. 결과: 모바일에서 코드 블록 syntax highlight + frame + line-highlight + diff
 * 등 plan012/plan017 작업 결과 전부 무력화 (흰 바탕 + 검정 글자).
 *
 * 이 테스트는 wrapper className 에 modifier 없는 단독 `prose` 가 항상 포함됨을 강제.
 * 미래에 누군가 `prose-sm md:prose` 같은 modifier-only 패턴으로 회귀시키면 즉시 빨강.
 */
describe("MarkdownRenderer wrapper className — prose 클래스 회귀 가드", () => {
  const SOURCE_PATH = join(__dirname, "MarkdownRenderer.tsx");
  const source = readFileSync(SOURCE_PATH, "utf-8");

  it("wrapper className 에 unconditional 'prose' 클래스 포함 (md: 등 prefix 없는 단독)", () => {
    const match = source.match(/className="([^"]*prose[^"]*)"/);
    expect(match, "wrapper div 에 prose 가 들어간 className 이 있어야 함").toBeTruthy();
    const tokens = match![1].split(/\s+/).filter(Boolean);
    // unconditional prose 가 토큰에 직접 있어야 (md:prose / sm:prose 같은 prefix 형은 제외)
    expect(
      tokens.includes("prose"),
      `wrapper className 에 단독 "prose" 가 없음 — 모바일에서 globals.css 의 .prose 셀렉터 매칭 실패. 현재: ${match![1]}`,
    ).toBe(true);
  });

  it("wrapper className 의 prose 토큰이 size modifier 와 결합된 형태가 아님 (단독 prose 존재)", () => {
    // wrapper 의 className 토큰만 검사 — 다른 곳의 문자열 영향 없음
    const match = source.match(/className="([^"]*prose[^"]*)"/);
    const tokens = match![1].split(/\s+/).filter(Boolean);
    const proseTokens = tokens.filter((t) => t === "prose" || /:prose$/.test(t));
    // 단독 "prose" 가 토큰에 있어야 — md:prose / sm:prose 만 있으면 모바일에서 매칭 실패
    expect(
      proseTokens.includes("prose"),
      `prose 토큰들: ${JSON.stringify(proseTokens)} — 단독 "prose" 없음`,
    ).toBe(true);
  });
});
