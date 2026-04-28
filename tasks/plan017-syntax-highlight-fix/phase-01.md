# Phase 01 — globals.css shiki 셀렉터 교체 + 색상 회귀 테스트 추가

**Model**: sonnet
**Status**: pending

---

## 목표

`/posts/[...slug]` 페이지의 코드 블록 syntax highlighting 누락 버그 수정. 진단 결과 `src/app/globals.css:358-367` 의 shiki dual theme 규칙이 `.shiki` className 을 가정하지만, **rehype-pretty-code v14 의 실제 출력에는 `.shiki` className 이 없음**. 셀렉터를 `.code-card-body pre span` 으로 교체하면 매칭 가능. 회귀 테스트를 추가해 셀렉터 / 출력 구조 변동 시 즉시 감지.

**범위 외**: rehype-pretty-code 버전 변경, theme 변경 (github-light/dark 유지), CodeCard / pretty-code-options 변경.

---

## 진단 결과 (참고)

실제 HAST 출력 (`pnpm node` 로 unified pipeline 직접 호출 결과):

```
figure { data-rehype-pretty-code-figure: "" }
  pre  { data-language: "ts", data-theme: "github-light github-dark" }
    code { data-language: "ts", data-theme: "github-light github-dark", style: "display: grid;" }
      span { data-line: "" }
        span { style: "--shiki-light:#D73A49;--shiki-dark:#F97583" }
```

각 token span 은 `--shiki-light` / `--shiki-dark` CSS 변수만 inline 으로 보유. `color` 속성은 부모 (`.code-card-body pre`, line 288 `color: var(--color-fg-secondary)`) 에서 inherit → 단색.

---

## 작업 항목 (3)

### 1. `src/app/globals.css` — shiki 셀렉터 교체

**before** (358–367):

```css
/* shiki dual theme — html.dark 클래스 기반 토글 */
html.dark .shiki,
html.dark .shiki span {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
}
html:not(.dark) .shiki,
html:not(.dark) .shiki span {
  color: var(--shiki-light) !important;
  background-color: var(--shiki-light-bg) !important;
}
```

**after**:

```css
/* shiki dual theme — rehype-pretty-code v14 는 .shiki className 부여하지 않으므로
 * .code-card-body 의 pre/code 후손 span 을 직접 타깃. html.dark 클래스로 토글.
 * keepBackground: false 와 결합되어 background-color 는 부모 (.code-card-body pre) 가 담당. */
html.dark .code-card-body pre span {
  color: var(--shiki-dark);
}
html:not(.dark) .code-card-body pre span {
  color: var(--shiki-light);
}
```

변경점:
- `.shiki, .shiki span` → `.code-card-body pre span` (실제 DOM 매칭)
- `background-color` 규칙 제거 — `keepBackground: false` 와 globals.css line 286 `background: transparent !important` 가 이미 처리. 중복 제거
- `!important` 제거 — `.code-card-body pre span` 이 `.code-card-body pre` 보다 더 specific 하므로 자연 우선. !important 는 향후 디버깅 어렵게 만들 뿐

### 2. `src/lib/markdown.test.ts` (또는 신규 `syntax-highlight.test.ts`) — 회귀 테스트 추가

기존 `markdown.test.ts` 가 있으면 그 안에 새 `describe` 블록 추가. 없으면 `src/components/markdown/unified-pipeline.test.ts` 신규.

테스트 의도: rehype-pretty-code 출력의 핵심 불변식 검증 — 향후 라이브러리 업데이트로 출력 구조가 바뀌면 즉시 감지.

```ts
import { describe, it, expect } from "vitest";
import { parseMarkdownToHast } from "./unified-pipeline";

describe("rehype-pretty-code output structure (regression guard for plan017)", () => {
  it("produces span tokens with --shiki-light + --shiki-dark CSS variables", async () => {
    const tree = await parseMarkdownToHast("```ts\nconst x = 42;\n```");

    // figure > pre > code > span[data-line] > span[style="--shiki-..."]
    const figure = (tree as any).children.find((c: any) => c.tagName === "figure");
    expect(figure?.properties?.["data-rehype-pretty-code-figure"]).toBeDefined();

    const pre = figure.children.find((c: any) => c.tagName === "pre");
    expect(pre?.properties?.["data-language"]).toBe("ts");
    expect(pre?.properties?.["data-theme"]).toContain("github-light");
    expect(pre?.properties?.["data-theme"]).toContain("github-dark");

    const code = pre.children.find((c: any) => c.tagName === "code");
    const lineSpan = code.children.find((c: any) => c.tagName === "span" && c.properties?.["data-line"] !== undefined);
    expect(lineSpan).toBeDefined();

    // 토큰 span 들이 --shiki-light + --shiki-dark CSS 변수를 inline style 로 보유
    const tokenSpans = lineSpan.children.filter((c: any) => c.tagName === "span");
    expect(tokenSpans.length).toBeGreaterThan(0);
    const styleStrs = tokenSpans.map((s: any) => s.properties?.style ?? "");
    expect(styleStrs.some((s: string) => s.includes("--shiki-light"))).toBe(true);
    expect(styleStrs.some((s: string) => s.includes("--shiki-dark"))).toBe(true);
  });

  it("does NOT add .shiki className (selector contract held by globals.css)", async () => {
    const tree = await parseMarkdownToHast("```ts\nconst x = 42;\n```");
    const figure = (tree as any).children.find((c: any) => c.tagName === "figure");
    const pre = figure.children.find((c: any) => c.tagName === "pre");

    // .shiki className 부재가 globals.css 의 .code-card-body pre span 셀렉터 선택의 근거.
    // 이게 깨지면 (= rehype-pretty-code 가 .shiki 부여하기 시작하면) globals.css 도 다시 검토 필요.
    const className = (pre?.properties?.className as string[] | undefined) ?? [];
    expect(className).not.toContain("shiki");
  });
});
```

test runner 는 vitest. `pnpm test --run` 으로 검증.

### 3. `src/app/globals.css` — line 288 의 fg-secondary inherit 영향 문서화 (주석)

기존 line 283–289:

```css
.prose .code-card-body pre {
  margin: 0;
  padding: 16px 20px;
  background: transparent !important; /* keepBackground:false 와 결합 */
  border: none !important;
  color: var(--color-fg-secondary);
}
```

`color: var(--color-fg-secondary)` 가 fallback 으로 작동 — shiki 가 색을 못 잡는 inline code (`bypassInlineCode: true` 로 미처리) 등에서 자연 톤. **이 줄은 유지** 하되, 의도 메모를 한 줄 주석으로 명시:

```css
.prose .code-card-body pre {
  margin: 0;
  padding: 16px 20px;
  background: transparent !important; /* keepBackground:false 와 결합 */
  border: none !important;
  /* fallback color — shiki 가 처리하지 못한 영역 (data-line 외부, plain text 등). 
   * 토큰 span 은 아래 .code-card-body pre span 규칙이 var(--shiki-{light|dark}) 로 override. */
  color: var(--color-fg-secondary);
}
```

코드 변경 아닌 주석만 추가 — 향후 디버깅 시 의도 추적 시간 절약.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/app/globals.css` | shiki 셀렉터 교체 (`.shiki` → `.code-card-body pre span`) + fallback color 의도 주석 |
| `src/components/markdown/unified-pipeline.test.ts` (또는 `src/lib/markdown.test.ts` 의 새 describe) | rehype-pretty-code 출력 구조 회귀 테스트 2개 |

## 검증

```bash
pnpm lint
pnpm type-check
pnpm test --run

# 신규 테스트가 실제로 추가되어 통과하는지 확인
pnpm test --run -- syntax-highlight 2>&1 | grep -E "(passed|failed)" | head -3

# globals.css 의 셀렉터 교체 확인
grep -n "\.code-card-body pre span" src/app/globals.css
! grep -n "html\.dark \.shiki" src/app/globals.css        # 이전 셀렉터 제거됨
! grep -n "html:not(\.dark) \.shiki" src/app/globals.css  # 이전 셀렉터 제거됨
```

수동 smoke (`pnpm dev`):
- 코드 블록이 있는 글 (예: `/posts/...` 의 plan011 / plan012 / plan014 관련 글) 접속
- 다크 모드: 키워드 (`const`, `function`, `if`) 가 빨간 톤, 변수명이 파란 톤 — github-dark 색상 표시
- 라이트 모드 토글: github-light 색상으로 즉시 전환
- 모바일 뷰: `[data-line-numbers]` 가 있으면 line numbers 숨김 (기존 동작 유지)
- diff / terminal variant 도 정상 (background tint + prefix `+` `-` `$` 그대로)

## 의도 메모 (왜)

- **셀렉터 교체 vs 출력에 className 추가**: rehype-pretty-code 옵션엔 `.shiki` className 강제 옵션 없음. unified-pipeline 후처리로 className 주입은 가능하지만 (rehype-class-names 등 추가 플러그인) 의존성 추가 + 빌드 비용. CSS 셀렉터 교체가 zero-cost, 1 line
- **`!important` 제거**: 새 셀렉터는 `.code-card-body pre span` (specificity 0,3,2) > `.code-card-body pre` (specificity 0,2,1). 자연 우선 — `!important` 불필요. 향후 다른 사람 (또는 미래의 나) 가 디버깅할 때 `!important` 가 적을수록 좋음
- **회귀 테스트 2개**: ① "출력에 `--shiki-light` / `--shiki-dark` 가 있다" ② "`.shiki` className 이 없다". 둘 다 globals.css 셀렉터의 전제조건. 라이브러리 업데이트로 둘 중 하나라도 깨지면 즉시 빨갛게 표시 → 운영 회귀 차단
- **fallback `color: var(--color-fg-secondary)` 유지** 이유: shiki 미처리 영역 (figcaption, plain text wrapper 등) 에서 일관 톤. 주석으로 의도 명시해 향후 "왜 이 줄이 있나" 의문 차단
