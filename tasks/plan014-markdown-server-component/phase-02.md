# Phase 02 — MarkdownRenderer 를 server async 로 재작성 + react-markdown 의존성 제거

## 컨텍스트 (자기완결 프롬프트)

phase-01 에서 server-only `unified-pipeline.ts` + `markdownComponents` 분리 완료 전제. 이 phase 는 `MarkdownRenderer.tsx` 를 server async 로 재작성하고 react-markdown 을 의존성에서 제거. 호출처 (`posts/[...slug]/page.tsx` + `category/[...path]/page.tsx`) 는 이미 server async — 호환 OK.

### 사전 게이트

```bash
# cwd: <worktree root>

# 1) phase-01 산출물
test -f src/components/markdown/unified-pipeline.ts
test -f src/components/markdown/components.tsx
grep -n "export async function parseMarkdownToHast" src/components/markdown/unified-pipeline.ts
grep -n "export function createMarkdownComponents" src/components/markdown/components.tsx

# 2) 기존 MarkdownRenderer 사용처 — 모두 server component (async function Page)
grep -n "async function" src/app/posts/\[...slug\]/page.tsx | head -1   # async page 확인
grep -n "async function" src/app/category/\[...path\]/page.tsx | head -1

# 3) react-markdown 아직 존재
grep -n '"react-markdown":' package.json
```

## 작업 목록 (총 5개)

### 1. `src/components/MarkdownRenderer.tsx` 재작성

기존 285 라인을 약 30-40 라인으로 축소. `"use client"` 제거 + async 함수.

```tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { parseMarkdownToHast } from "./markdown/unified-pipeline";
import { createMarkdownComponents } from "./markdown/components";

interface MarkdownRendererProps {
  content: string;
  basePath: string;
}

export async function MarkdownRenderer({ content, basePath }: MarkdownRendererProps) {
  const tree = await parseMarkdownToHast(content);
  return (
    <div className="prose-sm md:prose prose-gray dark:prose-invert max-w-none">
      {toJsxRuntime(tree, {
        Fragment,
        jsx,
        jsxs,
        passNode: true,
        components: createMarkdownComponents(basePath),
      })}
    </div>
  );
}
```

설계 메모:
- `"use client"` 완전 제거 (BLG6 — 잘못 마킹됐던 것)
- **`passNode: true` 필수**: hast-util-to-jsx-runtime 의 default 는 false → 핸들러의 `node` prop 이 undefined 가 되면 `figure`/`pre` 의 `data-rehype-pretty-code-figure` / `data-language` 검사 모두 무력화 → 코드블록 frame / mermaid 분기 깨짐. 절대 빠뜨리지 말 것
- **`createMarkdownComponents(basePath)` 함수형 호출**: phase-01 작업 3 에서 factory 로 정의됨. `a` 핸들러가 closure 로 basePath 를 캡처해 `resolveMarkdownLink(href, basePath)` 호출
- React 19 + Next.js 16 에서 `react/jsx-runtime` 의 `Fragment` / `jsx` / `jsxs` import 는 정상 (React 18+ 표준)

### 2. `src/components/MarkdownRenderer.regression-1.test.ts` async + import path 변경

기존 테스트 (현재 `import { isMermaidPreNode } from "./MarkdownRenderer"` — 9 케이스) 의 import path 를 phase-01 에서 이동된 components.tsx 로 갱신:

```ts
// before
import { isMermaidPreNode } from "./MarkdownRenderer";
// after
import { isMermaidPreNode } from "./markdown/components";
```

테스트가 `MarkdownRenderer` 를 직접 렌더하는 케이스가 있다면 async 호출 패턴으로:

```ts
// before: render(<MarkdownRenderer content={...} />)
// after: render(await MarkdownRenderer({ content: ..., basePath: ... }))
```

vitest 는 async 컴포넌트 호출 결과 (JSX) 를 그대로 render 가능. testing-library 의 `render` 가 async 컴포넌트를 직접 받지 못하면 `await` 한 결과를 받으면 됨.

기존 9 테스트 케이스 의도 모두 보존 (코드 블록 / mermaid / GFM 표 / 헤딩 slug / inline code 등 회귀 방지).

### 3. `package.json` 에서 `react-markdown` 제거

```bash
# cwd: <worktree root>
pnpm remove react-markdown

# 검증
! grep -n '"react-markdown":' package.json
! grep -rn 'from "react-markdown"' src/
```

### 4. 호출처 변경 검증 (호환 확인 — 코드 변경 0)

`posts/[...slug]/page.tsx` + `category/[...path]/page.tsx` 는 이미 async server component. JSX 안에서 `<MarkdownRenderer ... />` 를 그대로 사용해도 server component 가 server component 를 자식으로 렌더하는 표준 RSC 패턴 → 변경 불필요.

```bash
# cwd: <worktree root>
# 호출 시그니처가 그대로인지 확인 (content + basePath)
grep -n "<MarkdownRenderer" src/app/posts/\[...slug\]/page.tsx
grep -n "<MarkdownRenderer" src/app/category/\[...path\]/page.tsx
```

### 5. 통합 검증

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test -- --run
pnpm build

# build 시 server-only 가드가 client 트리에서 import 되지 않는지 확인 (build 통과면 OK)
# 만약 server-only 위반이면 build 가 즉시 실패하며 오류 메시지에 "server-only" 명시
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) MarkdownRenderer 가 server component (use client 제거 + async)
! grep -n '"use client"' src/components/MarkdownRenderer.tsx
grep -nE "export async function MarkdownRenderer" src/components/MarkdownRenderer.tsx

# 2) react-markdown 의존성 / import 모두 제거
! grep -n '"react-markdown":' package.json
! grep -rn 'from "react-markdown"' src/

# 3) hast-util-to-jsx-runtime 사용 + react/jsx-runtime import + passNode + createMarkdownComponents
grep -n 'from "hast-util-to-jsx-runtime"' src/components/MarkdownRenderer.tsx
grep -n 'from "react/jsx-runtime"' src/components/MarkdownRenderer.tsx
grep -n "toJsxRuntime" src/components/MarkdownRenderer.tsx
grep -n "passNode: true" src/components/MarkdownRenderer.tsx                # 필수 (CRITICAL)
grep -n "createMarkdownComponents(basePath)" src/components/MarkdownRenderer.tsx

# 3-1) regression test import path 갱신
grep -n 'from "./markdown/components"' src/components/MarkdownRenderer.regression-1.test.ts
! grep -n 'from "./MarkdownRenderer"' src/components/MarkdownRenderer.regression-1.test.ts | grep -v "from './MarkdownRenderer'\\s*$"

# 4) 호출처 시그니처 변경 없음
grep -n "<MarkdownRenderer content=" src/app/posts/\[...slug\]/page.tsx
grep -n "<MarkdownRenderer content=" src/app/category/\[...path\]/page.tsx

# 5) MarkdownRenderer.tsx 라인 수 (대폭 축소 확인)
test "$(wc -l < src/components/MarkdownRenderer.tsx)" -lt 60

# 6) regression test 통과
pnpm test -- --run src/components/MarkdownRenderer.regression-1.test.ts

# 7) 빌드 + 회귀
pnpm test -- --run
pnpm lint
pnpm type-check
pnpm build

# 8) 금지사항
! grep -nE "as any" src/components/MarkdownRenderer.tsx
! grep -nE "console\.(log|warn|error)" src/components/MarkdownRenderer.tsx
```

## PHASE_BLOCKED 조건

- `hast-util-to-jsx-runtime` 의 `components` prop 시그니처가 react-markdown 과 호환 안 됨 → 핸들러 내부 `node?.properties?.[...]` 접근 형태 변경 필요. 즉시 보고
- `pnpm build` 시 `server-only` 가드가 다른 import path 에서 위반 → SearchDialog / 다른 client component 가 MarkdownRenderer 를 import 하는지 확인 (현재 grep 상 없음)
- regression test 가 깨짐 → 의미 보존 가능한 fix 시도 후 안 되면 보고

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋:
- `feat(markdown): convert MarkdownRenderer to server async component (ADR-020)`
- `chore(deps): drop react-markdown — replaced by unified async`
