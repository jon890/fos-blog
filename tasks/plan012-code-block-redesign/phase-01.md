# Phase 01 — rehype-pretty-code 마이그레이션 + CodeCard + 코드블록 frame 토큰 + 기존 글 syntax 검증

## 컨텍스트 (자기완결 프롬프트)

plan009 (design tokens) + plan011 (article page redesign) 머지 완료 전제. Claude Design Round 2 mockup 의 코드 블록 (`/tmp/components.css` 라인 440-577 의 `.code-card / .code-content / .term-block`) 패턴을 fos-blog 의 글 상세 페이지 코드 블록에 적용. 기존 `rehype-highlight` 를 **`rehype-pretty-code` (shiki 기반)** 로 마이그레이션하면서 frame meta (filename / lang badge / copy / line numbers) 와 line-highlight / diff / terminal variants 를 도입.

scope 외:
- 글 상세 페이지 레이아웃 / Hero / TOC / prose 일반 → **plan011 에서 처리됨**
- inline `code` 토큰 색 → **plan011 의 `.prose :not(pre) > code` 룰에서 처리됨**
- mermaid pre 격리 → **plan011 에서 selector 격리 됨**. 이번 phase 는 pretty-code 가 mermaid 를 건드리지 않게 skip 만 보장
- collapsible long blocks → **별도 issue** (Q9 (iv))
- mockup 의 8 토큰 (k/s/n/c/f/t/v/p) 에 정확히 맞춘 자체 shiki theme → **plan012-2** 후속 (이번 phase 는 dual github theme)

### 현재 baseline (변경 대상)

`src/components/MarkdownRenderer.tsx` (210 라인):
- `rehypeHighlight` + `import "highlight.js/styles/github-dark.css"` 사용 중
- `pre` 컴포넌트 오버라이드: `<pre className="my-4 p-4 rounded-lg bg-gray-900 ...">` 하드코딩
- `code` 컴포넌트: language 추출 + mermaid 분기 + inline code 분기. fenced block 은 그대로 통과
- `isMermaidPreNode()` 함수로 mermaid pre 식별 (plan011 에서 격리)

`src/app/globals.css` (plan011 후):
- `.prose pre` 룰 (기존 `bg-gray-900 dark:bg-gray-800` `@apply`) — **이번 phase 에서 제거 또는 대체**
- `.prose :not(pre) > code` 인라인 코드 룰 (plan011) — **변경 없음**
- mermaid 격리 셀렉터 — **변경 없음**

`package.json`:
- `rehype-highlight` + `highlight.js` 사용 중. 다른 사용처 없으면 제거. 사용처 grep 으로 사전 확인 필수.

### 이 phase 의 핵심 전환

1. **syntax engine 교체**: `rehype-highlight` → `rehype-pretty-code` (Q1 C). shiki dual theme `{ light: 'github-light', dark: 'github-dark' }` (Q7 D) — `data-theme` 자동 토글
2. **frame meta**: filename via ` ```ts title="filename.ts" ` (Q2 B), lang badge (mockup `.lang` 톤), line numbers `showLineNumbers` (Q3 B). 모바일 (md 미만) 에선 line numbers CSS 로 숨김 (Q9 i)
3. **CodeCard client wrapper**: `<pre>` 를 `<CodeCard>` 로 wrap → copy button (clipboard) + idle/copied state (Q4 A+B). copy button 은 shadcn Button (variant="ghost" size="xs", plan009 도입)
4. **line-highlight**: ` ```ts {3-5,7} ` syntax (Q6 A). pretty-code 가 자동 처리, mockup `.ln.hl` 톤으로 색
5. **variants**: diff = ` ```diff ` 자동 (mockup `.ln.add/.ln.del`), terminal = ` ```bash / ```sh ` 자동 (Q5 권장 — mockup `.term-block` 톤)
6. **language 미지정 fallback**: pretty-code 의 `defaultLang: 'plaintext'` (Q8 A)
7. **highlight.js 의존성 제거**: 다른 사용처 grep 후 0 이면 `package.json` 에서 제거. import (`highlight.js/styles/github-dark.css`) 도 제거
8. **mermaid skip**: pretty-code 의 `filter` 옵션으로 ` ```mermaid ` 블록은 처리 skip → 기존 Mermaid 컴포넌트가 그대로 받음
9. **기존 글 호환 검증**: fos-study 글들에 비표준 ` ```ts:filename.ts ` 같은 syntax 가 있는지 사전 grep (DB 의 posts.content 또는 sync 데이터 검증). 있으면 **PHASE_BLOCKED** 처리 — 별도 마이그레이션 plan 필요

## 먼저 읽을 문서

- `docs/adr.md` — **ADR-017** (디자인 시스템)
- `docs/design-inspiration.md` — Round 2 코드블록 mockup 메모
- `/tmp/components.css` — `.code-card / .code-card-head / .code-content / .term-block` (라인 440-577)
- `src/components/MarkdownRenderer.tsx` — 현재 rehype-highlight 사용
- `src/app/globals.css` — plan011 후 prose 룰
- `.claude/skills/_shared/common-critic-patterns.md` — 시드 7 패턴

## 사전 게이트

```bash
# cwd: <worktree root>

# 1) plan009 + plan011 머지 완료
grep -n -- "--mesh-stop-01" src/app/globals.css
grep -n "ArticleHero" src/app/posts/\[...slug\]/page.tsx
grep -n "counter-reset: prose-h2" src/app/globals.css

# 2) 기존 컴포넌트 확인
test -f src/components/MarkdownRenderer.tsx
grep -n "rehypeHighlight" src/components/MarkdownRenderer.tsx
grep -n "isMermaidPreNode" src/components/MarkdownRenderer.tsx
test -f src/components/ui/button.tsx

# 3) Round 2 mockup 추출
tar xzOf ~/.claude/projects/-Users-nhn-personal-fos-blog/d11b8756-7896-451b-932e-0678c2241d67/tool-results/webfetch-1777098410179-5850mb.bin 'fos-blog/project/components.css' > /tmp/components.css
grep -n "CODE BLOCK\|code-card\|term-block" /tmp/components.css | head -10  # >= 5 라인

# 4) highlight.js 다른 사용처 grep — 없어야 자유 제거 가능
grep -rn "highlight.js\|hljs" src/ --include="*.ts" --include="*.tsx" | grep -v MarkdownRenderer.tsx
# 결과 0 이어야 함. 다른 사용처 발견되면 그쪽 마이그레이션 함께 처리

# 5) 기존 글의 비표준 코드블록 syntax 검증 — fos-study 글들이 ```ts:filename 같은 syntax 사용 중이면 깨짐
# 로컬 DB 또는 fos-study 직접 grep
DB_OK=0
docker exec fos-blog-db mysql -u fos_user -pfos_password fos_blog -e \
  "SELECT post_id, SUBSTRING(content, LOCATE('\`\`\`', content), 80) AS sample
   FROM posts WHERE content REGEXP '\`\`\`[a-z]+:[^[:space:]]' AND is_active = 1
   LIMIT 5;" 2>/dev/null && DB_OK=1
if [ "$DB_OK" = "0" ]; then
  # critic M9 fallback: DB 미접근 시 fos-study 레포 직접 검색 (gh CLI)
  echo "DB 미접근 — fos-study 레포 직접 grep 으로 fallback:"
  gh search code --repo jon890/fos-study '/```[a-z]+:/' --limit 10
  # 결과가 있으면 sample 1-2건을 사용자에게 보여 PHASE_BLOCKED 결정
fi
# 결과가 있으면 → PHASE_BLOCKED: 비표준 syntax 마이그레이션 plan 분리 필요
```

## 작업 목록 (총 5개)

### 1. 의존성 교체

```bash
# cwd: <worktree root>
pnpm add rehype-pretty-code shiki
pnpm remove rehype-highlight highlight.js
```

`package.json` 검증:
- `dependencies` 에 `rehype-pretty-code`, `shiki` 추가
- `dependencies` 에서 `rehype-highlight`, `highlight.js` 제거 (사전 게이트 4 통과 시)

### 2. `src/components/CodeCard.tsx` 신규 (client wrapper)

```tsx
"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeCardProps {
  filename?: string;
  language?: string;
  rawCode: string;       // 클립보드 복사용 원본 텍스트
  variant?: "code" | "diff" | "terminal";
  children: React.ReactNode;  // pretty-code 산출물 (<pre>)
}

const COPY_TIMEOUT_MS = 2000;

export function CodeCard({ filename, language, rawCode, variant = "code", children }: CodeCardProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      const t = setTimeout(() => setCopied(false), COPY_TIMEOUT_MS);
      return () => clearTimeout(t);
    } catch {
      // 사용자에게는 ARIA 로 알림 (alert 금지 — review 패턴)
      setCopied(false);
    }
  }, [rawCode]);

  return (
    <figure className={cn("code-card my-6", variant === "terminal" && "code-card--terminal")}>
      <header className="code-card-head">
        <div className="left">
          {language && <span className="lang">{language}</span>}
          {filename && <span className="filename">{filename}</span>}
        </div>
        <div className="right">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleCopy}
            aria-label={copied ? "복사됨" : "코드 복사"}
            className="cb-btn"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span className="sr-only md:not-sr-only md:ml-1.5">{copied ? "copied" : "copy"}</span>
          </Button>
          {/* critic MINOR a11y: copied 상태 변경을 스크린리더에 통지 */}
          <span aria-live="polite" className="sr-only">
            {copied ? "코드가 클립보드에 복사되었습니다" : ""}
          </span>
        </div>
      </header>
      <div className="code-card-body">{children}</div>
    </figure>
  );
}
```

설계 메모:
- shadcn Button (`variant="ghost" size="xs"`) — plan009 도입한 Button 재사용
- copy 실패 시 native alert 금지 — `setCopied(false)` 로 idle 유지 + ARIA label 만 갱신
- variant="diff" 는 frame 만 동일, 내부 `<pre>` 는 pretty-code 가 +/- 마크업 처리
- variant="terminal" 은 `code-card--terminal` modifier — globals.css 에서 mockup `.term-block` 톤 적용

### 3. `src/components/MarkdownRenderer.tsx` 수정

핵심 변경:

```tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypePrettyCode, { type Options as PrettyCodeOptions } from "rehype-pretty-code";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import type { Components } from "react-markdown";
import Image from "next/image";
import { Mermaid } from "./Mermaid";
import { CodeCard } from "./CodeCard";
import { resolveMarkdownLink } from "@/lib/resolve-markdown-link";

// rehype-highlight 와 highlight.js/styles/github-dark.css import 제거

const PRETTY_CODE_OPTIONS: PrettyCodeOptions = {
  theme: { light: "github-light", dark: "github-dark" },
  defaultLang: "plaintext",
  keepBackground: false,        // background 는 우리 토큰으로 처리
  bypassInlineCode: true,       // ⚠️ critic C4: 인라인 code 는 plan011 의 .prose :not(pre) > code 룰 보존 필수
  // ⚠️ critic C1: rehype-pretty-code Options 에 `filter` 는 존재하지 않음.
  // mermaid skip 은 components.code 핸들러에서 className="language-mermaid" 우선 분기로 처리.
  // pretty-code 는 inline 외 fenced block 모두 처리하므로 mermaid 도 변환 대상이지만,
  // react-markdown components.code 에서 className 으로 잡아 <Mermaid> 로 라우팅하면 우회 가능.
};
```

**⚠️ critic C1 후속 — mermaid skip 검증 게이트 (PHASE 시작 직후, executor 가 코드 작성 전 PoC 로 확인):**
```bash
# cwd: <worktree root>
# rehype-pretty-code 가 ```mermaid 블록의 className="language-mermaid" 를 보존하는지 PoC.
# 보존하면 components.code 분기로 잡힌다. 보존 안 하면 별도 사전 rehype 플러그인으로
# placeholder 치환 + 후처리 복원 패턴 필요 (이 경우 PHASE_BLOCKED 처리 후 재설계).
cat > /tmp/pretty-code-poc.mjs <<'EOF'
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";

const md = "```mermaid\ngraph TD; A-->B\n```\n";
const html = await unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypePrettyCode, { theme: "github-light", defaultLang: "plaintext", bypassInlineCode: true })
  .use(rehypeStringify)
  .processSync(md);

console.log(String(html));
console.log("HAS_MERMAID_CLASS:", String(html).includes("language-mermaid") ? "YES" : "NO");
EOF
node /tmp/pretty-code-poc.mjs
```

`HAS_MERMAID_CLASS: NO` 인 경우 **PHASE_BLOCKED**: pretty-code 가 className 을 덮어씀 → components.code 분기 무효 → 사전 rehype 플러그인 추가 필요.

```tsx
// ⚠️ critic C2/C3: rehype-pretty-code 의 출력 구조
// title 메타: <figure data-rehype-pretty-code-figure>
//                <figcaption data-rehype-pretty-code-title>{filename}</figcaption>
//                <pre><code data-language={lang} data-line-numbers?>...</code></pre>
//             </figure>
// title 없는 코드 블록: <pre><code data-language={lang}>...</code></pre> (figure wrap 안 됨)
//
// 따라서 wrap 은 components.figure 에서 처리. components.pre 는 mermaid + 무 title 케이스.

// figure 컴포넌트 — pretty-code 가 wrap 한 figure 만 CodeCard 로 변환
figure: ({ children, node, ...props }) => {
  const dataFigure = node?.properties?.["data-rehype-pretty-code-figure"];
  if (dataFigure === undefined || dataFigure === null) {
    // pretty-code 출력이 아닌 일반 figure (markdown image caption 등) 는 그대로
    return <figure {...props}>{children}</figure>;
  }

  // 자식 트리에서 메타 추출 — figcaption.textContent + code.data-language
  const filename = findChildText(node, "figcaption", "data-rehype-pretty-code-title");
  const language = findCodeProp(node, "data-language");
  const rawCode = extractRawText(node);
  const variant: "code" | "diff" | "terminal" =
    language === "diff" ? "diff"
    : language === "bash" || language === "sh" || language === "shell" ? "terminal"
    : "code";

  return (
    <CodeCard filename={filename} language={language} rawCode={rawCode} variant={variant}>
      {children}
    </CodeCard>
  );
},

// pre 컴포넌트 — title 없는 단순 fenced block + mermaid 우회
pre: ({ children, node, ...props }) => {
  if (isMermaidPreNode(node as { children?: HastChild[] })) {
    return <>{children}</>;
  }
  // figure wrap 이 없으면 pretty-code 결과여도 figure 핸들러로 안 들어옴.
  // 이 경로는 (a) plain ``` 블록 + plain pre 또는 (b) title 없는 pretty-code 결과.
  // (b) 도 CodeCard 로 wrap 하려면 여기서도 메타 추출해서 wrap. 단 filename 은 항상 undefined.
  const language = findCodeProp(node, "data-language");
  const rawCode = extractRawText(node);
  const variant: "code" | "diff" | "terminal" =
    language === "diff" ? "diff"
    : language === "bash" || language === "sh" || language === "shell" ? "terminal"
    : "code";

  return (
    <CodeCard filename={undefined} language={language} rawCode={rawCode} variant={variant}>
      <pre {...props}>{children}</pre>
    </CodeCard>
  );
},

// code 컴포넌트 — mermaid + inline code 분기 보존 (plan011 룰 그대로)
code: ({ className, children, node, ...props }) => {
  const langMatch = /language-(\w+)/.exec(className ?? "");
  if (langMatch?.[1] === "mermaid") {
    return <Mermaid chart={String(children).trim()} />;
  }
  // inline code 는 bypassInlineCode:true 로 pretty-code 가 건드리지 않음.
  // plan011 의 .prose :not(pre) > code 룰이 그대로 적용.
  return <code className={className} {...props}>{children}</code>;
},
```

`rehypePlugins` 배열:
```tsx
rehypePlugins={[rehypeSlug, [rehypePrettyCode, PRETTY_CODE_OPTIONS], rehypeRaw]}
```

**hast 헬퍼 (`src/lib/markdown.ts` 에 추가 — critic M6 fix: 위치 단정 + 시그니처 명시):**

```ts
import type { Element as HastElement, ElementContent } from "hast";

// hast 트리에서 모든 text node 의 value 를 이어붙임.
// pretty-code 가 wrapping 한 [data-line] span 들 사이에는 명시적 \n 삽입 (clipboard 복사 라인 보존).
export function extractRawText(node: HastElement | ElementContent): string {
  if (!("type" in node)) return "";
  if (node.type === "text") return node.value;
  if (node.type !== "element") return "";

  const isLine = node.properties?.["data-line"] !== undefined;
  const inner = (node.children ?? []).map(extractRawText).join("");
  return isLine ? inner + "\n" : inner;
}

// figcaption 등 element 의 textContent 만 추출 (data-line 처리 없이)
export function findChildText(
  node: HastElement,
  tagName: string,
  requiredProp?: string,
): string | undefined {
  // 자손에서 첫 번째 매칭 element 찾기 → 그 children 의 text node value 들을 join
  // (구현은 executor 에 위임. 단순 DFS)
}

// 자손 code element 의 특정 data-* property 추출
export function findCodeProp(node: HastElement, propName: string): string | undefined {
  // 첫 번째 자손 <code> 의 properties[propName] 반환
  // (구현은 executor 에 위임)
}
```

성공 기준에 추가: `grep -nE "export function (extractRawText|findChildText|findCodeProp)" src/lib/markdown.ts | wc -l   # = 3`

설계 메모:
- `keepBackground: false` — background 는 우리 globals.css 의 `.code-card-body` 룰로 처리
- `bypassInlineCode: true` — plan011 의 `.prose :not(pre) > code` 인라인 룰 보존
- mermaid skip 은 components.code 의 `language-mermaid` 분기로 처리 (pretty-code Options 에 `filter` 없음 — fictional API 였음)
- pretty-code 가 figure-wrap 하는 케이스 (title 메타 있을 때) 와 figure 없는 케이스 (title 없음) 모두 components 핸들러에서 처리
- `rehypeRaw` 는 마지막 (HTML 통과). pretty-code 가 먼저 syntax 변환

### 4. `src/app/globals.css` — 코드 블록 frame 토큰

mockup `.code-card / .code-card-head / .code-content / .term-block` 룰을 우리 토큰으로 추가.

```css
/* === 코드 블록 frame === */
.prose .code-card {
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  background: var(--color-bg-subtle);
  overflow: hidden;
  margin: 24px 0;
}
.prose .code-card-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px;
  background: var(--color-bg-base);
  border-bottom: 1px solid var(--color-border-subtle);
  font-family: var(--font-mono); font-size: 12px;
}
.prose .code-card-head .left {
  display: flex; align-items: center; gap: 10px;
  color: var(--color-fg-secondary);
}
.prose .code-card-head .lang {
  font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 2px 6px; border-radius: 3px;
  color: var(--color-brand-400);
  background: color-mix(in oklch, var(--color-brand-400), transparent 88%);
  border: 1px solid color-mix(in oklch, var(--color-brand-400), transparent 70%);
}
.prose .code-card-head .filename { color: var(--color-fg-primary); }
.prose .code-card-head .right { display: flex; align-items: center; gap: 6px; }
.prose .code-card-head .cb-btn { /* shadcn Button 위에 mockup 톤 미세 보정 */
  font-family: var(--font-mono); font-size: 11px;
  color: var(--color-fg-muted);
}

/* code body */
.prose .code-card-body {
  font-family: var(--font-mono);
  font-size: 13px; line-height: 1.7;
  overflow-x: auto;
}
.prose .code-card-body pre {
  margin: 0;
  padding: 16px 20px;
  background: transparent !important;  /* keepBackground:false 와 결합 */
  border: none !important;
  color: var(--color-fg-secondary);
}

/* line numbers — pretty-code 의 [data-line-numbers] 플래그가 있을 때만 게이트
   ⚠️ critic M5 fix: 이전 plan 은 모든 코드 블록에 line numbers 강제 → terminal 의 $ 가
   shell 다중 라인 출력에 부적절. showLineNumbers 메타가 있을 때만 표시. */
.prose .code-card-body code {
  display: grid;
  counter-reset: line;
}
.prose .code-card-body code [data-line] {
  display: inline-block;
  width: 100%;
  padding: 0 16px;
}
/* [data-line-numbers] (showLineNumbers 메타) 있을 때만 카운터 증가 + ::before 표시 */
.prose .code-card-body code[data-line-numbers] [data-line] {
  counter-increment: line;
}
.prose .code-card-body code[data-line-numbers] [data-line]::before {
  content: counter(line);
  display: inline-block;
  width: 2.5ch;
  margin-right: 1.5ch;
  text-align: right;
  color: var(--color-fg-faint);
  font-size: 12px;
}
@media (max-width: 767px) {
  .prose .code-card-body code[data-line-numbers] [data-line]::before {
    display: none;  /* Q9 (i) — 모바일 line numbers 숨김 */
  }
}

/* line-highlight (Q6) */
.prose .code-card-body code [data-highlighted-line] {
  background: color-mix(in oklch, var(--color-brand-400), transparent 92%);
  border-left: 2px solid var(--color-brand-400);
}

/* diff variant — pretty-code 가 [data-diff="add"|"remove"] 부여 */
.prose .code-card-body code [data-diff="add"] {
  background: color-mix(in oklch, var(--color-success), transparent 88%);
  border-left: 2px solid var(--color-success);
}
.prose .code-card-body code [data-diff="add"]::before {
  content: "+";  /* line number 대신 + 표시 */
}
.prose .code-card-body code [data-diff="remove"] {
  background: color-mix(in oklch, var(--color-error), transparent 90%);
  border-left: 2px solid var(--color-error);
}
.prose .code-card-body code [data-diff="remove"]::before {
  content: "-";
}

/* terminal variant — code-card--terminal modifier */
.prose .code-card--terminal {
  background: var(--color-bg-base);
}
.prose .code-card--terminal .code-card-body pre {
  font-family: var(--font-mono);
}
/* terminal: $ prompt 는 첫 라인만 (shell 다중 라인 출력 시 후속 라인은 prompt 없음).
   ⚠️ critic M5 후속: 모든 라인에 $ 붙이는 건 부적절. */
.prose .code-card--terminal .code-card-body [data-line]:first-child::before {
  content: "$";
  color: var(--color-brand-400);
  font-weight: 500;
  width: auto;
  margin-right: 1ch;
}

/* shiki dual theme — html.dark 일 때만 dark theme 활성 */
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

설계 메모:
- 모든 룰 `.prose` 하위로 한정 — 다른 페이지 영향 0
- pretty-code 의 dual theme 출력 (`--shiki-light` + `--shiki-dark` CSS variables) 을 우리 `<html class="dark">` 토글과 매칭
- `keepBackground: false` 와 `background: transparent !important` 결합 — frame 의 bg-subtle 이 winner
- 모바일 line numbers 숨김은 `@media (max-width: 767px)` (Tailwind `md` breakpoint = 768px)

### 5. 기존 prose pre 룰 정리 + 통합 검증

`src/app/globals.css` 의 기존 `.prose pre` 룰 (plan011 이전 상태 유지된 부분) 검토 후 충돌 제거:

```css
/* plan011 이전 룰 — 이번 phase 에서 제거 또는 통합 */
.prose pre { @apply bg-gray-900 dark:bg-gray-800 rounded-lg overflow-x-auto border border-gray-700; }
.prose pre code { @apply text-gray-100 bg-transparent p-0; }
```

→ **모두 제거**. 이번 phase 의 `.code-card-body pre` 룰이 대체.

#### 통합 검증

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test -- --run
pnpm build

# mermaid 회귀 (plan011 에서 도입된 mermaid 회귀 테스트가 그대로 통과해야 함)
# critic M4 (plan011 fix 그대로): 정확한 파일명 + N>=1 통과 강제
pnpm test -- --run MarkdownRenderer.regression 2>&1 | tee /tmp/plan012-mermaid-test.log
grep -E "Tests +[1-9][0-9]* passed" /tmp/plan012-mermaid-test.log
! grep -E "[1-9][0-9]* failed" /tmp/plan012-mermaid-test.log

# 빌드 산출물에 shiki + 새 토큰 반영
grep -rE "code-card|data-rehype-pretty-code|shiki" .next/server/app/posts/ 2>/dev/null | head -3

# critic M7: shiki standalone build 런타임 smoke
# wasm + theme JSON 이 standalone 출력 트리에 포함되는지 확인.
# (그렇지 않으면 docker 배포 후 코드 블록 렌더 시 런타임 깨짐)
test -d .next/standalone && {
  STANDALONE_HAS_SHIKI=$(grep -rE "shiki|onig" .next/standalone 2>/dev/null | wc -l)
  echo "standalone shiki refs: $STANDALONE_HAS_SHIKI"
  [ "$STANDALONE_HAS_SHIKI" -gt 0 ] || echo "WARN: standalone에 shiki 참조 없음 — Dockerfile 검토 필요"
}
```

수동 smoke (선택, 사용자 PR 리뷰 시):
- `pnpm dev` → 코드 블록 글 확인 (typescript / bash / diff / mermaid 모두)
- copy 버튼 동작 (clipboard 복사 + 2초 후 idle 복귀)
- 다크/라이트 토글 → shiki dual theme 색 전환
- 모바일 (Chrome DevTools 360px) → line numbers 숨김 + 가로 스크롤
- line-highlight 가 들어간 글 (없으면 임시 글로 검증) → `{3-5}` syntax 동작

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 의존성 교체
grep -n '"rehype-pretty-code"' package.json
grep -n '"shiki"' package.json
! grep -n '"rehype-highlight"' package.json
! grep -n '"highlight.js"' package.json

# 2) MarkdownRenderer 변경
grep -n 'from "rehype-pretty-code"' src/components/MarkdownRenderer.tsx
! grep -n 'rehype-highlight' src/components/MarkdownRenderer.tsx
! grep -n 'highlight.js/styles' src/components/MarkdownRenderer.tsx
grep -n "CodeCard" src/components/MarkdownRenderer.tsx
grep -n 'theme:.*github-light' src/components/MarkdownRenderer.tsx
grep -n 'theme:.*github-dark' src/components/MarkdownRenderer.tsx
grep -n 'defaultLang.*plaintext' src/components/MarkdownRenderer.tsx
grep -n 'keepBackground.*false' src/components/MarkdownRenderer.tsx
grep -n 'language-mermaid' src/components/MarkdownRenderer.tsx

# 3) CodeCard 신규
test -f src/components/CodeCard.tsx
grep -n '"use client"' src/components/CodeCard.tsx
grep -n 'export function CodeCard' src/components/CodeCard.tsx
grep -n "navigator.clipboard.writeText" src/components/CodeCard.tsx
grep -n 'from "@/components/ui/button"' src/components/CodeCard.tsx
! grep -nE "alert\(|confirm\(|prompt\(" src/components/CodeCard.tsx

# 4) globals.css 토큰
grep -n "\.code-card " src/app/globals.css
grep -n "\.code-card-head" src/app/globals.css
grep -n "data-highlighted-line" src/app/globals.css
grep -n 'data-diff="add"' src/app/globals.css
grep -n 'data-diff="remove"' src/app/globals.css
grep -nE "code-card--terminal" src/app/globals.css
grep -n "shiki-dark" src/app/globals.css
grep -n "shiki-light" src/app/globals.css

# 5) 기존 prose pre 룰 제거
! grep -nE "\.prose pre\s*\{[^}]*bg-gray-900" src/app/globals.css
! grep -nE "\.prose pre code\s*\{[^}]*text-gray-100" src/app/globals.css

# 6) 모바일 line numbers 숨김
grep -nE "@media.*max-width:\s*767px" src/app/globals.css
grep -nE "data-line\]::before.*display:\s*none" src/app/globals.css

# 7) 빌드 + 회귀
pnpm test -- --run
pnpm lint
pnpm type-check
pnpm build

# 8) 금지사항
! grep -nE "as any" src/components/CodeCard.tsx src/components/MarkdownRenderer.tsx
! grep -nE "console\.(log|warn|error)" src/components/CodeCard.tsx src/components/MarkdownRenderer.tsx
```

## PHASE_BLOCKED 조건

- plan009 또는 plan011 미머지 (사전 게이트 1 실패) → **PHASE_BLOCKED: 선행 plan 필요**
- `highlight.js` 가 다른 곳에서 import 중 (사전 게이트 4) → **PHASE_BLOCKED: 다른 사용처 마이그레이션 우선**
- 기존 글에 비표준 ` ```ts:filename ` syntax 사용 중 (사전 게이트 5) → **PHASE_BLOCKED: 비표준 syntax 마이그레이션 plan 분리 필요** (별도 issue 등록 후 진행)
- pretty-code PoC (작업 3 mermaid skip 검증 게이트) 에서 `HAS_MERMAID_CLASS: NO` → **PHASE_BLOCKED: components.code 분기 무효 → 사전 rehype 플러그인 (mermaid placeholder 치환 + 후처리 복원) 추가 설계 필요**
- shiki 빌드 시간이 30초 이상 증가 → **PHASE_BLOCKED: shiki language bundle 축소 또는 lazy import 검토**
- standalone build 산출물에 shiki/onig wasm 미포함 → **PHASE_BLOCKED: Dockerfile / next.config 의 outputFileTracingIncludes 검토**

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋:
- `chore(deps): swap rehype-highlight → rehype-pretty-code (shiki dual theme)`
- `feat(code-block): add CodeCard wrapper with copy button (shadcn)`
- `feat(code-block): integrate filename / line-numbers / line-highlight / diff / terminal variants`
- `feat(globals): replace .prose pre rules with .code-card frame tokens`
