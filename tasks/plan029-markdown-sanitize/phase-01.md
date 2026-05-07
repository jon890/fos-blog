# Phase 01 — rehype-sanitize 도입 + allowlist + 회귀 테스트

**Model**: sonnet
**Goal**: Markdown 렌더 파이프라인에 `rehype-sanitize` 추가해 `<script>` / `<iframe>` / `on*` 핸들러를 차단하면서 shiki 코드 하이라이팅 + GFM 표 + heading id + mermaid 등 정상 패턴은 모두 보존.

## Context (자기완결)

`src/components/markdown/unified-pipeline.ts` 의 chain:

```ts
unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })  // ← raw HTML 통과 허용
  .use(rehypeRaw)                                   // ← raw HTML 을 hast 로 정상 변환
  .use(rehypeSlug)
  .use(rehypePrettyCode, PRETTY_CODE_OPTIONS);
```

`allowDangerousHtml: true` + `rehypeRaw` 가 글 본문의 `<script>` / `<iframe>` / `<a onclick="...">` 같은 raw HTML 을 그대로 hast 로 변환 → `hast-util-to-jsx-runtime` 이 React 트리로 렌더 → DOM 에 attach.

현재 콘텐츠 출처는 `jon890/fos-study` 자기 소유 → 즉각 위험은 낮음. 그러나 fos-study compromise / 외부 contributor 도입 / 댓글 본문이 markdown 으로 렌더되는 경우 XSS 가능.

## 결정 (사용자 2026-05-07)

**Option A 채택** — `rehype-sanitize` 를 chain 말미에 추가. `defaultSchema` 를 확장해 shiki / pretty-code / slug 의 data-* + className 을 allowlist 에 등록.

## 작업 항목

### 1. 의존성 추가

```bash
# cwd: <repo root>
pnpm add rehype-sanitize
```

`rehype-sanitize` 는 `hast-util-sanitize` 의 unified plugin wrapper. `defaultSchema` 가 안전 baseline (script/iframe/on* 차단 + 안전 element/attribute allowlist) 제공.

### 2. `src/components/markdown/sanitize-schema.ts` 신규

```ts
import { defaultSchema, type Schema } from "rehype-sanitize";

/**
 * fos-blog 의 unified pipeline 용 sanitize schema.
 *
 * defaultSchema 를 확장해서 다음을 추가 허용:
 * - rehype-pretty-code 의 shiki span data-line / data-highlighted-line
 * - rehype-pretty-code 의 figure data-rehype-pretty-code-figure / data-language / data-theme
 * - rehype-slug 의 heading id
 * - GFM table align / footnote ref
 *
 * 차단 유지 (defaultSchema 정책):
 * - <script>, <iframe>, <object>, <embed>, <form>
 * - on* 이벤트 핸들러 (onclick, onload 등)
 * - javascript: / data: (이미지 제외) URL
 */
export const sanitizeSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      "className",
      ["data-language"],
      ["data-theme"],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      "className",
      // shiki 는 토큰별 색을 inline style 로 적용 (예: style="color: #abcdef") —
      // CSS injection 잠재 위험이 있으나 syntax highlighting 동작에 필수.
      // sanitize 후에도 보존되어야 하므로 의도적 allowlist.
      "style",
      ["data-line"],
      ["data-highlighted-line"],
      ["data-highlighted-chars"],
      ["data-chars-id"],
    ],
    figure: [
      ...(defaultSchema.attributes?.figure ?? []),
      ["data-rehype-pretty-code-figure"],
    ],
    figcaption: [
      ...(defaultSchema.attributes?.figcaption ?? []),
      ["data-rehype-pretty-code-title"],
    ],
    pre: [
      ...(defaultSchema.attributes?.pre ?? []),
      "className",
      // shiki/pretty-code 가 pre 컨테이너에도 inline style 을 둘 수 있음 (배경색 등) — span 과 동일 사유로 의도적 허용.
      "style",
      "tabIndex",
      ["data-language"],
      ["data-theme"],
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      "className",
      ["data-rehype-pretty-code-fragment"],
    ],
    // heading id (rehype-slug)
    h1: [...(defaultSchema.attributes?.h1 ?? []), "id"],
    h2: [...(defaultSchema.attributes?.h2 ?? []), "id"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "id"],
    h4: [...(defaultSchema.attributes?.h4 ?? []), "id"],
    h5: [...(defaultSchema.attributes?.h5 ?? []), "id"],
    h6: [...(defaultSchema.attributes?.h6 ?? []), "id"],
  },
};
```

executor 는 실제 `rehypePrettyCode` 출력의 data-* 속성을 한 번 콘솔로 dump 해서 누락된 속성이 있는지 확인 (예: `data-chars-class-id`, `data-chars-line-numbers`). 누락 발견 시 위 schema 에 추가.

### 3. `src/components/markdown/unified-pipeline.ts` 수정

```ts
import rehypeSanitize from "rehype-sanitize";
import { sanitizeSchema } from "./sanitize-schema";

async function buildProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypePrettyCode, PRETTY_CODE_OPTIONS)
    .use(rehypeSanitize, sanitizeSchema);  // ← chain 말미 (slug + pretty-code 출력 검증)
}
```

**중요**: `rehypeSanitize` 는 chain 말미. 이전 plugin 이 만든 데이터까지 검증 대상이 되도록.

### 4. 회귀 테스트 — `src/components/markdown/sanitize.test.ts` 신규

핵심 케이스 (각 케이스마다 `parseMarkdownToHast(md)` 호출 후 결과 hast 트리 검증).

테스트 파일 상단 import 는 다음과 같이 작성 (executor 가 누락하지 않도록 명시):

```ts
import { describe, expect, it } from "vitest";
import { toHtml } from "hast-util-to-html";
import { parseMarkdownToHast } from "./unified-pipeline";
```

본문:

```ts
describe("sanitize", () => {
  it("script 태그 제거", async () => {
    const md = "본문\n\n<script>alert(1)</script>\n\n끝";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree); // hast-util-to-html 또는 직접 traverse
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("iframe 태그 제거", async () => {
    const md = "본문\n\n<iframe src=\"https://evil.com\"></iframe>\n\n끝";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("evil.com");
  });

  it("on* 이벤트 핸들러 제거", async () => {
    const md = `<a href="/x" onclick="alert(1)">link</a>`;
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("href=\"/x\"");
    expect(html).not.toContain("onclick");
  });

  it("javascript: URL 차단", async () => {
    const md = `[link](javascript:alert(1))`;
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).not.toContain("javascript:");
  });

  // 보존 케이스
  it("코드 블록 shiki span data-line + pretty-code allowlist 정합성", async () => {
    const md = "```ts\nconst x = 1;\n```";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("data-line");
    expect(html).toContain("data-rehype-pretty-code-figure");
    // allowlist 정합성 — pretty-code/shiki 가 출력하는 핵심 속성이 sanitize 후에도 살아남는지
    expect(html).toContain("data-language");
    expect(html).toContain("data-theme");
    expect(html).toMatch(/class=/);
  });

  it("heading id (rehype-slug) 보존", async () => {
    const md = "## Hello World";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toMatch(/<h2[^>]*id="hello-world"/);
  });

  it("GFM 표 보존", async () => {
    const md = "| a | b |\n|---|---|\n| 1 | 2 |";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
  });

  it("inline code / strong / em 보존", async () => {
    const md = "**굵게** _이탤릭_ `코드`";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("<strong");
    expect(html).toContain("<em");
    expect(html).toContain("<code");
  });

  it("이미지 alt + src 보존", async () => {
    const md = `![cat](https://example.com/cat.png)`;
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("src=\"https://example.com/cat.png\"");
    expect(html).toContain("alt=\"cat\"");
  });

  it("정상 anchor 의 href 보존", async () => {
    const md = `[link](https://example.com)`;
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("href=\"https://example.com\"");
  });
});
```

`hast-util-to-html` 은 dev dependency 추가:
```bash
pnpm add -D hast-util-to-html
```

또는 hast tree 직접 traverse 로 검증.

### 5. mermaid 호환 점검

기존 mermaid 블록은 어떻게 렌더되는지 확인 (코드 블록의 className 으로 처리되는지, 별도 SVG inline 인지). SVG inline 이면 schema 에 `svg` / `g` / `path` 등도 allowlist 필요할 가능성. 현재 `defaultSchema` 는 SVG 제한적 — 실제 mermaid 글 1개 렌더 결과 점검 후 schema 보강.

이번 phase 의 work item 으로는 **점검만 수행** — 깨지면 아래 시작 element 목록을 schema 에 추가, 깨지지 않으면 OOS.

**SVG allowlist 시작점** (mermaid 출력에서 자주 등장하는 요소):

```ts
// sanitize-schema.ts 에 추가 후보
tagNames: [
  ...(defaultSchema.tagNames ?? []),
  "svg", "g", "path", "text", "tspan",
  "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "defs", "marker", "use", "style",
],
attributes: {
  ...defaultSchema.attributes,
  svg: ["xmlns", "viewBox", "width", "height", "preserveAspectRatio", "class", "style"],
  g: ["transform", "class", "style"],
  path: ["d", "fill", "stroke", "stroke-width", "stroke-dasharray", "marker-end", "marker-start", "class", "style"],
  text: ["x", "y", "dx", "dy", "text-anchor", "dominant-baseline", "class", "style", "font-family", "font-size"],
  tspan: ["x", "y", "dx", "dy", "class", "style"],
  rect: ["x", "y", "width", "height", "rx", "ry", "fill", "stroke", "class", "style"],
  circle: ["cx", "cy", "r", "fill", "stroke", "class", "style"],
  marker: ["id", "viewBox", "refX", "refY", "markerWidth", "markerHeight", "orient"],
},
```

executor 가 mermaid 글 렌더 결과 dump (`document.querySelector(".mermaid svg").outerHTML`) 후 누락 element/attribute 를 위 목록에 보강. style 허용은 mermaid 의 inline 색상 표현을 위해 필요 (shiki 와 동일 사유).

### 6. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

grep -n "rehype-sanitize" package.json
test -f src/components/markdown/sanitize-schema.ts
test -f src/components/markdown/sanitize.test.ts
grep -n "rehypeSanitize" src/components/markdown/unified-pipeline.ts
```

수동 smoke (사용자 안내):
- `pnpm dev` → 글 상세 페이지 진입:
  - 코드 블록 syntax highlight 정상 (shiki 토큰별 색)
  - mermaid 다이어그램 렌더 (있는 글)
  - heading id anchor (TOC 클릭 → 스크롤 이동)
  - GFM 표 / footnote 정상

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/components/markdown/unified-pipeline.ts` | 수정 (rehypeSanitize 추가) |
| `src/components/markdown/sanitize-schema.ts` | 신규 |
| `src/components/markdown/sanitize.test.ts` | 신규 |
| `package.json` | 수정 (rehype-sanitize + hast-util-to-html devDep) |

## Out of Scope

- 댓글 본문 sanitize (Comments 는 현재 Markdown 렌더 안 함 — plain text)
- mermaid SVG schema 완전 정의 (위 항목 5 점검 결과에 따라 OOS 또는 IN)
- rehypeRaw 자체 제거 (Option B — fos-study 글의 raw HTML 사용 영향 예측 비용 큼)
- 글 작성 시 자동 lint (CI 단)

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| pretty-code data-* allowlist 누락으로 syntax highlight 색이 깨짐 | 회귀 테스트 (작업 4) 의 "코드 블록 shiki span data-line 보존" 케이스 + 수동 smoke |
| mermaid SVG schema 누락 시 다이어그램 깨짐 | 작업 5 점검 — 깨지면 schema 에 svg/g/path/text/rect/circle 등 추가. mermaid 글 1개를 회귀 테스트에 추가 |
| GFM footnote / task list 등 추가 element 누락 | defaultSchema 가 이미 `<sup>`, `<input type="checkbox">` 포함 — 회귀 테스트로 검증 |
| Lighthouse Accessibility 점수 변동 (heading id 누락 등) | id allowlist 명시 (작업 2) — Lighthouse CI 자동 체크 |
| 기존 글의 raw `<details>` / `<sub>` 등 깨짐 | defaultSchema 가 details/summary/sub/sup 모두 포함 — 영향 없음. 의심 시 fos-study grep 으로 사용 element 확인 |
