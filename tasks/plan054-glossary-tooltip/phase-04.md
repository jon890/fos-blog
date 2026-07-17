# Phase 04 — Markdown 용어 툴팁 통합

**Execution profile**: standard
**Status**: completed

---

## 목표

글 본문과 카테고리 README의 개념별 첫 등장에 접근 가능한 설명 툴팁을 표시한다.

**범위 외**: `/glossary` 목록 화면과 Footer 링크.

## 작업 항목 (5)

### 1. 요청별 HAST 변환기

`src/components/markdown/glossary-transform.ts`를 server-only 모듈로 추가한다.
sanitize가 끝난 HAST를 받아 text node를 순회하고 phase 03 matcher 결과를 `<abbr data-glossary-id="...">`로 바꾼다.

제외 subtree는 heading, anchor, code, pre, KaTeX, Mermaid, 기존 abbr다.
같은 `id`는 HAST 문서 순서에서 한 번만 변환한다.
입력 glossary가 비어 있거나 비활성화되면 tree를 바꾸지 않는다.

### 2. `GlossaryTooltip` client island

`src/components/glossary/GlossaryTooltip.tsx`를 추가한다.

- desktop hover·focus, mobile click으로 연다.
- ESC, 바깥 pointer, 다른 tooltip open event로 닫는다.
- trigger는 점선 밑줄과 `cursor-help`를 사용한다.
- `aria-describedby`, `role="tooltip"`, 고유 id를 연결한다.
- `fullName`, `summary`, `/glossary#<id>` 링크를 표시한다.
- JavaScript fallback을 위해 trigger에 plain `title`을 둔다.

### 3. Markdown component mapping

`createMarkdownComponents(basePath, glossaryById)`가 `abbr`의 `data-glossary-id`를 읽는다.
검증된 map에 없는 id는 일반 `<abbr>`로 렌더한다.
map에 있으면 `GlossaryTooltip`에 필요한 값만 전달한다.

`src/components/markdown/*`의 신규·변경 server module에는 `import "server-only"` 가드를 유지한다.

### 4. `MarkdownRenderer` 계약

다음 optional props를 추가한다.

```ts
glossaryTerms?: MatchableGlossaryTerm[];
enableGlossary?: boolean;
```

기본값은 활성화다.
기존 processor singleton을 재설정하지 않고 `parseMarkdownToHast()` 반환 tree에 요청별 변환기를 적용한다.

### 5. 글과 README 호출자 통합

`src/app/posts/[...slug]/page.tsx`와 `src/app/category/[...path]/page.tsx`가 `GlossaryService`를 통해 matchable terms를 읽어 `MarkdownRenderer`에 전달한다.
DB 조회 실패 시 warning을 남기고 빈 배열로 렌더해 본문 자체는 유지한다.

client tooltip DOM 테스트와 HAST 변환 회귀 테스트를 추가한다.
server-only HAST 모듈 테스트는 기존 Markdown 회귀 테스트처럼 `server-only`를 mock해 test environment와 production guard를 함께 보존한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/components/markdown/glossary-transform.ts` | 신규 HAST 변환기 |
| `src/components/markdown/glossary-transform.test.ts` | 제외·최초 등장 테스트 |
| `src/components/glossary/GlossaryTooltip.tsx` | 신규 client tooltip |
| `src/components/glossary/GlossaryTooltip.test.tsx` | hover·focus·tap·ESC 테스트 |
| `src/components/markdown/components.tsx` | abbr mapping |
| `src/components/MarkdownRenderer.tsx` | glossary props와 변환 호출 |
| `src/app/posts/[...slug]/page.tsx` | 글 glossary 조회 |
| `src/app/category/[...path]/page.tsx` | README glossary 조회 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog/.claude/worktrees/plan054-glossary-tooltip
# branch: feat/plan054-glossary-tooltip
pnpm test src/components/markdown/glossary-transform.test.ts src/components/glossary/GlossaryTooltip.test.tsx
pnpm type-check
rg -n 'import "server-only"' src/components/markdown/glossary-transform.ts src/components/markdown/components.tsx
```

기대값:

- 테스트와 type-check exit code가 0이다.
- 마지막 `rg`가 두 server module의 guard를 출력한다.

## 의도 메모 (왜)

- ADR-032에 따라 dynamic term list를 processor `.use()`에 주입하지 않는다.
- sanitize 이후 생성 노드는 검증된 DB 정의의 `id`만 담고 raw description HTML을 넣지 않는다.
- app layer는 infra를 새로 직접 참조하지 않고 `GlossaryService`를 경유한다.
