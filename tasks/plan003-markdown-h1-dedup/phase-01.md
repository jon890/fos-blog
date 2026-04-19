# Phase 01 — stripLeadingH1 유틸 + 단위 테스트 + 글 상세/FolderPage 적용

## 컨텍스트 (자기완결 프롬프트)

글 상세 페이지(`<h1>{title}</h1>`) + Markdown 본문 내 첫 `# Title` 이 모두 렌더되어 **H1 이 2개** 가 되는 문제를 해결한다. Markdown 원본은 건드리지 않고, 렌더 직전에 선두 h1 을 제거하는 전처리 유틸을 추가한다.

## 먼저 읽을 문서

- `docs/adr.md` — **ADR-010 Markdown 본문 선두 H1 제거** (핵심 결정)
- `src/lib/markdown.ts` — 기존 `parseFrontMatter`, `extractTitle` 패턴
- `.claude/skills/_shared/common-critic-patterns.md` — P5 기계 검증 / BLG2 구조화 로그

## 기존 코드 참조

- `src/lib/markdown.ts:12-57` — `parseFrontMatter()` 함수. 반환 shape: `{ frontMatter, content }`
- `src/lib/markdown.ts:59-74` — `extractTitle()` — 본문 첫 h1 추출
- `src/app/posts/[...slug]/page.tsx:105-107` — `parseFrontMatter(content)` → `mainContent` 사용부
- `src/app/posts/[...slug]/page.tsx:228` — `<MarkdownRenderer content={mainContent} basePath={slug} />`
- `src/app/category/[...path]/page.tsx:183-193` — README 렌더 블록: `<MarkdownRenderer content={readme} basePath={`${folderPath}/README`} />`
- `src/services/PostService.test.ts` / `src/services/SyncService.test.ts` — Vitest 스타일 참고

## 작업 목록 (총 4개)

### 1. `stripLeadingH1` 유틸 추가 — `src/lib/markdown.ts`

기존 exports 뒤에 append:

```ts
/**
 * Markdown 본문의 **선두 H1 라인 + 뒤이은 공백 라인** 을 제거한다.
 * ADR-010 참조.
 *
 * - frontmatter 가 남아 있어도 OK (선두 공백 라인 skip 후 첫 비공백 라인 검사)
 * - 첫 비공백 라인이 `^#\s+.+$` 이면 그 라인 + 뒤이어지는 공백 라인(연속) 제거
 * - 첫 비공백 라인이 h1 이 아니면 변경 없음
 * - 본문 중간에 등장하는 h1 은 유지 (섹션 마커)
 */
export function stripLeadingH1(content: string): string {
  const lines = content.split("\n");
  let i = 0;
  // 선두 공백 라인 skip
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return content;
  // 첫 비공백이 h1 이 아니면 원본 반환
  if (!/^#\s+.+$/.test(lines[i])) return content;
  // h1 라인 제거
  i++;
  // 뒤이어지는 공백 라인 skip
  while (i < lines.length && lines[i].trim() === "") i++;
  return lines.slice(i).join("\n");
}
```

주의:
- **정규식** `^#\s+.+$` — `##` 이상(h2, h3) 은 매치하지 않음 (정확히 1개의 `#` + 공백 1개 이상)
- TOP-only: 중간 h1 은 건드리지 않음

### 2. 단위 테스트 — `src/lib/markdown.test.ts` (신규)

파일: `src/lib/markdown.test.ts`

아래 케이스 검증 (Vitest):

1. **h1 없는 본문** → 원본 그대로
   ```
   ## Section\n본문...
   ```

2. **선두 h1 + 본문** → h1 제거
   ```
   # Title\n\n본문 내용
   ```
   → `본문 내용`

3. **선두 공백 + h1 + 공백 + 본문** → h1 제거 + 뒤 공백 제거
   ```
   \n\n# Title\n\n\n본문
   ```
   → `본문`

4. **빈 content** → 빈 문자열 그대로

5. **중간 h1 유지**
   ```
   본문 첫 단락\n\n# Mid Heading\n\n본문 이어서
   ```
   → 변경 없음 (첫 비공백이 h1 아님)

6. **h2 는 건드리지 않음**
   ```
   ## Only Section\n본문
   ```
   → 변경 없음

7. **`#` 하나만 + 공백 없음** (ex: `#main`) → 건드리지 않음 (regex `#\s+` 이므로)

테스트 구조:
```ts
import { describe, it, expect } from "vitest";
import { stripLeadingH1 } from "./markdown";

describe("stripLeadingH1", () => {
  it("returns content unchanged when no leading h1", () => { /*...*/ });
  // ...
});
```

### 3. 글 상세 페이지 적용 — `src/app/posts/[...slug]/page.tsx`

현재 (line 105-107):
```ts
const { content: mainContent } = parseFrontMatter(content);
const title = extractTitle(content) || postData.title;
```

변경 후:
```ts
const { content: contentWithoutFrontmatter } = parseFrontMatter(content);
const mainContent = stripLeadingH1(contentWithoutFrontmatter);
const title = extractTitle(content) || postData.title;
```

- `extractTitle(content)` 은 원본 `content`(frontmatter+본문) 에서 title 을 뽑으므로 그대로 둠
- `mainContent` 만 stripLeadingH1 적용
- import 추가: `import { extractTitle, extractDescription, getReadingTime, generateTableOfContents, parseFrontMatter, stripLeadingH1 } from "@/lib/markdown";`

### 4. FolderPage README 렌더 적용 — `src/app/category/[...path]/page.tsx`

현재 README 렌더 (line 190 부근):
```tsx
<MarkdownRenderer content={readme} basePath={`${folderPath}/README`} />
```

변경 후:
```tsx
<MarkdownRenderer content={stripLeadingH1(readme)} basePath={`${folderPath}/README`} />
```

- import 추가: `import { stripLeadingH1 } from "@/lib/markdown";`
- 기존 readme 에 `# Folder` 같은 h1 이 있어도 페이지 레벨 `<h1>{currentFolder}` 와 중복 해소

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 유틸 export
grep -n "export function stripLeadingH1" src/lib/markdown.ts

# 2) 테스트 파일 + 통과
test -f src/lib/markdown.test.ts
pnpm test --run src/lib/markdown.test.ts

# 3) 글 상세 적용
grep -n "stripLeadingH1" src/app/posts/[...slug]/page.tsx
grep -n "stripLeadingH1" 'src/app/posts/[...slug]/page.tsx'

# 4) FolderPage README 적용
grep -n "stripLeadingH1" 'src/app/category/[...path]/page.tsx'

# 5) 본문 내 h1 1개로 감소 검증 (grep 으로 페이지 소스 확인 어려우므로 테스트가 대신 보장)
# → src/lib/markdown.test.ts 의 케이스 통과로 갈음

# 6) 전체 검증
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 7) 금지사항
! grep -nE "console\.(log|info|warn)" src/lib/markdown.ts
! grep -nE "as any" src/lib/markdown.ts src/app/posts/[...slug]/page.tsx 'src/app/category/[...path]/page.tsx'

# 8) regex 정밀성 — h2 를 실수로 매치하지 않는지 테스트에서 커버
grep -nE 'it\(.*h2' src/lib/markdown.test.ts
```

## PHASE_BLOCKED 조건

- `stripLeadingH1` 단위 테스트 1개 이상 실패 → **PHASE_BLOCKED: regex 또는 제거 로직 재검토 필요**
- 기존 `parseFrontMatter` 또는 `extractTitle` 의 동작이 stripLeadingH1 도입 후 회귀 (기존 테스트 깨짐) → **PHASE_BLOCKED: 유틸 간 의존 재검토**
- `pnpm build` 가 Markdown 전처리 체인 변경으로 실패 → **PHASE_BLOCKED: 빌드 로그 분석 필요**

## 완료 후 team-lead 처리

- 통합 검증 재확인 (`pnpm lint && pnpm type-check && pnpm test --run && pnpm build`)
- 커밋 분리 (atomic):
  - `feat(markdown): add stripLeadingH1 util with unit tests`
  - `fix(posts): dedupe H1 on post detail + folder readme render`
- PR 제목: `fix(seo): remove duplicate H1 on post/folder pages`
- PR 본문에 ADR-010 링크 + before/after heading 구조 예시 포함
- index.json `status: "completed"` 갱신 + 커밋 + push

## 커밋 제외 (phase 내부)

executor 는 이 phase 내부에서 커밋하지 않는다.
