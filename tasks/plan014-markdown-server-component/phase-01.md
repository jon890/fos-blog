# Phase 01 — unified-pipeline 모듈 신설 + shiki highlighter singleton + components mapping 분리

## 컨텍스트 (자기완결 프롬프트)

ADR-020 (plan014) 의사결정에 따라 `react-markdown` (sync only) 을 제거하고 `unified.process()` async 로 마크다운 변환을 server component 에서 수행한다. 이 phase 는 server-only 모듈 + components mapping 분리만 처리. 실제 `MarkdownRenderer` 교체는 phase-02.

### 현재 baseline

`src/components/MarkdownRenderer.tsx`:
- 285 라인, `"use client"` 마킹 (단 `useState`/`useEffect` 0건 — 잘못된 마킹)
- `react-markdown` 의 `<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug, [rehypePrettyCode, PRETTY_CODE_OPTIONS], rehypeRaw]} components={components}>` 사용
- `components` 객체에 `figure` (CodeCard wrapper), `pre` (mermaid 분기), 기타 표/리스트/링크 등 매핑

`package.json` direct dep 에 `react-markdown ^9.0.1` 존재. `unified` / `remark-parse` / `remark-rehype` / `hast-util-to-jsx-runtime` 은 **이미 transitive 로 설치됨** (확인: `find node_modules/.pnpm -maxdepth 1 -type d -name "unified*"`).

### 이 phase 의 핵심 전환

1. **`src/components/markdown/unified-pipeline.ts` 신설** (server-only) — unified processor + shiki highlighter singleton. 모듈 로드 시 1회 await 으로 highlighter 사전 init → 매 요청 비용 0
2. **`src/components/markdown/components.tsx` 신설** — 기존 `MarkdownRenderer.tsx` 의 `components` 객체를 그대로 분리 이동. CodeCard / Mermaid 등 client island import 는 그대로
3. **PRETTY_CODE_OPTIONS** 도 같은 디렉터리 모듈로 분리 (재사용성)
4. **package.json direct dep promote** — `unified` / `remark-parse` / `remark-rehype` / `hast-util-to-jsx-runtime` 을 dependencies 에 명시. `react-markdown` 은 **이 phase 에서 제거 안 함** (phase-02 에서 호출처 교체와 동시에)

### 사전 게이트

```bash
# cwd: <worktree root>

# 1) plan012 머지 완료 (rehype-pretty-code 도입)
grep -n "rehype-pretty-code" package.json
grep -n "rehypePrettyCode" src/components/MarkdownRenderer.tsx

# 2) transitive 의존성 사전 설치 확인
find node_modules/.pnpm -maxdepth 1 -type d -name "unified@*" -o -name "remark-parse@*" -o -name "remark-rehype@*" -o -name "hast-util-to-jsx-runtime@*" | wc -l   # = 4

# 3) 기존 MarkdownRenderer 사용처 (변경 안 됨, phase-02 작업)
grep -rn "MarkdownRenderer" src/app --include="*.tsx" | wc -l   # = 2 (posts/[...slug]/page.tsx + category/[...path]/page.tsx)

# 4) ADR-020 docs 반영 확인
grep -n "ADR-020" docs/adr.md
```

위 어느 하나라도 실패하면 **PHASE_BLOCKED**.

## 작업 목록 (총 4개)

### 1. `src/components/markdown/unified-pipeline.ts` 신설 (server-only)

```ts
import "server-only";
import { unified, type Processor } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import rehypePrettyCode from "rehype-pretty-code";
import type { Root as HastRoot } from "hast";
import { PRETTY_CODE_OPTIONS } from "./pretty-code-options";

let processorPromise: Promise<Processor> | null = null;

function getProcessor(): Promise<Processor> {
  if (!processorPromise) {
    processorPromise = (async () => {
      // shiki highlighter 는 rehype-pretty-code 내부에서 lazy init.
      // unified async chain 이라 첫 process() 호출 시 자동 await 됨 → 별도 사전 init 불필요.
      // 단 processor 자체는 module-level singleton 으로 캐싱하여 unified plugin chain 재구성 비용 0.
      return unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw)
        .use(rehypeSlug)
        .use(rehypePrettyCode, PRETTY_CODE_OPTIONS);
    })();
  }
  return processorPromise;
}

export async function parseMarkdownToHast(markdown: string): Promise<HastRoot> {
  const processor = await getProcessor();
  const tree = await processor.run(processor.parse(markdown));
  return tree as HastRoot;
}
```

설계 메모:
- `import "server-only"` — client 에서 import 시 빌드 에러 (Next.js 16 가드)
- module-level `processorPromise` singleton — 다중 동시 요청 시 race 방지 (Promise 자체 공유)
- `processor.parse() + processor.run()` 분리 — `parse` 는 sync (mdast), `run` 만 async (rehype 변환). 가독성

### 2. `src/components/markdown/pretty-code-options.ts` 신설

기존 `MarkdownRenderer.tsx:58-67` 의 `PRETTY_CODE_OPTIONS` 객체를 **그대로** 이동:

```ts
import type { Options as PrettyCodeOptions } from "rehype-pretty-code";

export const PRETTY_CODE_OPTIONS: PrettyCodeOptions = {
  theme: { light: "github-light", dark: "github-dark" },
  bypassInlineCode: true,
  keepBackground: false,
};
```

`MarkdownRenderer.tsx` 에서 직접 정의하던 것을 import 로 교체 (phase-02 에서).

### 3. `src/components/markdown/components.tsx` 신설

기존 `MarkdownRenderer.tsx:23-275` 의 `components` 객체 (특히 `figure` / `pre` / `isMermaidPreNode` 등 helper) 를 **그대로** 이동. 단 import 형태는 `hast-util-to-jsx-runtime` 의 `Components` 타입을 사용:

```ts
import type { Components } from "hast-util-to-jsx-runtime";
import { CodeCard } from "../CodeCard";
import { Mermaid } from "../Mermaid";
import { extractRawText, findChildText, findCodeProp } from "@/lib/markdown";

// (기존 isMermaidPreNode helper 그대로 이동)

export const markdownComponents: Partial<Components> = {
  figure: ({ node, children, ...props }) => {
    // (기존 figure 핸들러 본문 그대로)
  },
  pre: ({ node, children, ...props }) => {
    // (기존 pre 핸들러 본문 그대로 — mermaid 분기 포함)
  },
  // (기존 a / table / blockquote / hr 등 그대로)
};
```

설계 메모:
- 핸들러 본문은 phase-01 에서 **그대로 복사** (semantic 변경 0). 함수 인자 prop 형태가 react-markdown 의 `components` 와 hast-util-to-jsx-runtime 의 `Components` 가 거의 동일 (`node`, `children`, ...props) 라 그대로 동작
- 만약 type signature 차이로 type-check 실패하면 작업 5 (phase-01 에서 보수) 로 넘기지 말고 즉시 SendMessage 로 team-lead 에 보고 (scope 확장)

### 4. `package.json` direct dep promote + 통합 검증

```bash
# cwd: <worktree root>

# unified 생태계 4종 direct dep 추가 (이미 transitive — version 은 lockfile 그대로)
pnpm add unified@^11.0.5 remark-parse@^11.0.0 remark-rehype@^11.1.2 hast-util-to-jsx-runtime@^2.3.6

# react-markdown 은 phase-02 에서 제거 — 이 phase 에서 건드리지 않음
grep -n '"react-markdown"' package.json   # 아직 존재해야 함

# lint / type-check / test (단 test 는 신규 파일에 직접 import 없으니 통과 기대)
pnpm lint
pnpm type-check
pnpm test -- --run
pnpm build
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 신규 파일
test -f src/components/markdown/unified-pipeline.ts
test -f src/components/markdown/pretty-code-options.ts
test -f src/components/markdown/components.tsx

# 2) server-only 가드
grep -n 'import "server-only"' src/components/markdown/unified-pipeline.ts

# 3) processor singleton 패턴
grep -n "processorPromise" src/components/markdown/unified-pipeline.ts
grep -n "export async function parseMarkdownToHast" src/components/markdown/unified-pipeline.ts

# 4) PRETTY_CODE_OPTIONS export
grep -n "export const PRETTY_CODE_OPTIONS" src/components/markdown/pretty-code-options.ts
grep -nE "github-light|github-dark|bypassInlineCode|keepBackground" src/components/markdown/pretty-code-options.ts | wc -l   # >= 4

# 5) components export + figure / pre 핸들러 보존
grep -n "export const markdownComponents" src/components/markdown/components.tsx
grep -n "isMermaidPreNode\|data-rehype-pretty-code-figure\|data-language" src/components/markdown/components.tsx | wc -l   # >= 3

# 6) package.json direct dep
grep -nE '"unified":|"remark-parse":|"remark-rehype":|"hast-util-to-jsx-runtime":' package.json | wc -l   # = 4
grep -n '"react-markdown":' package.json   # = 1 (아직 있어야 함, phase-02 에서 제거)

# 7) MarkdownRenderer.tsx 는 이 phase 에서 변경 안 됨
git diff --name-only origin/main...HEAD -- src/components/MarkdownRenderer.tsx | wc -l   # = 0

# 8) 빌드 / 회귀
pnpm test -- --run
pnpm lint
pnpm type-check
pnpm build

# 9) 금지사항
! grep -nE "as any" src/components/markdown/
! grep -nE "console\.(log|warn|error)" src/components/markdown/
```

## PHASE_BLOCKED 조건

- transitive 의존성 미설치 (사전 게이트 2 실패) → `pnpm install` 후 재시도
- `hast-util-to-jsx-runtime` 의 `Components` 타입과 기존 react-markdown 핸들러 prop 형태가 호환 안 됨 → SendMessage 로 team-lead 에 보고 (phase-02 에서 호환 처리 필요)
- shiki highlighter 가 `unified.run()` async chain 에서도 동일한 `runSync finished async` 에러 발생 → phase-02 진입 불가, ADR-020 재검토

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋:
- `feat(markdown): add unified-pipeline + components mapping (server-only)`
- `chore(deps): promote unified ecosystem to direct dep`
