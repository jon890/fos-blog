# Phase 03 — 공용 matcher와 언급 페이지 역참조

**Execution profile**: standard
**Status**: completed

---

## 목표

렌더러와 sync indexer가 공유하는 결정적 matcher를 만들고 용어별 언급 페이지를 증분 갱신한다.

**범위 외**: 툴팁 UI, `/glossary` 화면.

## 작업 항목 (5)

### 1. `glossary-matcher` — 표현 정규화와 우선순위

`src/lib/glossary-matcher.ts`에 side effect 없는 matcher를 구현한다.

- 대표 용어와 별칭을 같은 `id`로 정규화한다.
- 문자열 길이 내림차순, 대표 용어 우선, `id` 오름차순으로 tie를 고정한다.
- `caseSensitive=false`는 locale 비의존 lower-case 비교를 사용한다.
- ASCII 영숫자 표현은 ASCII word 내부 부분 일치를 막고 한글 조사 인접은 허용한다.
- 한 페이지에서 같은 `id`는 최초 한 번만 반환한다.
- 겹치는 표현은 긴 표현을 우선한다.

### 2. Markdown mention scanner

`src/services/glossary-mention-scanner.ts`가 Markdown AST를 재귀 순회해 matched term id set을 반환하게 한다.
기존 direct dependency만 사용하고 traversal dependency를 추가하지 않는다.
scanner 입력은 post와 README 모두 `parseFrontMatter(content).content`로 frontmatter를 제거한 값이다.
렌더러가 표시하지 않는 frontmatter의 title, tag, category만으로 mention이 생성되지 않게 한다.

다음 node subtree는 건너뛴다.

- heading
- link, linkReference
- code, inlineCode
- math, inlineMath
- html

Mermaid fenced code는 code 제외 규칙으로 처리한다.

### 3. mention repository 계약

`GlossaryRepository`에 다음 write를 추가한다.

- `replaceAllMentions(rows)`
- `replacePageMentions(pageType, pagePath, rows)`
- `deletePageMentions(pageType, pagePath)`

각 replace는 transaction 안에서 delete 후 insert한다.
빈 row 배열을 명시적으로 처리한다.

read는 용어별 최근 수정 순으로 정렬하고 page type·path 조합으로 URL을 만들 수 있는 projection을 반환한다.

### 4. `GlossarySyncService` — full·incremental mention 갱신

`syncMentions({ definitionsChanged, changedPosts, changedReadmes })`를 추가한다.
`SyncService`는 `syncDefinitions()` 다음에 post·metadata를 저장하고, 그 결과를 받아 `syncMentions()`를 마지막에 호출한다.

정의가 바뀌면 post·metadata 반영이 끝난 DB에서 활성 post와 readme가 있는 folder를 읽어 mention을 다시 계산한다.
정의가 그대로면 phase 01의 `changedPosts`, `changedReadmes`만 교체하거나 삭제한다.
`changedReadmes`의 delete는 `deletePageMentions("category-readme", path)`로 처리한다.
glossary, post 변경·삭제, README 변경이 같은 incremental 목록에 있어도 저장 이후 상태만 색인한다.

결과는 다음 값을 반환한다.

```ts
{
  mentions: number;
  pagesReindexed: number;
}
```

page title과 updated time을 snapshot으로 저장한다.
동일 page에서 같은 term이 반복되어도 한 row만 생성한다.
`mentions`는 이번 실행의 변경 row 수가 아니라 갱신 후 DB에 저장된 mention row 총개수다.

### 5. `GlossaryService`와 테스트

`GlossaryService`에 renderer용 matchable terms 조회와 `/glossary`용 definition·mention 조회를 추가한다.
DB 실패 처리는 page caller가 빈 상태로 폴백할 수 있도록 error를 숨기지 않는다.

matcher, scanner, full rebuild, changed-page replace, deleted-page cleanup, 같은 페이지 중복 제거를 테스트한다.
frontmatter에만 있는 용어가 제외되는 case와 glossary·post·README 동시 변경 orchestration case를 포함한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/lib/glossary-matcher.ts` | 신규 공용 matcher |
| `src/lib/glossary-matcher.test.ts` | 경계·별칭·우선순위 테스트 |
| `src/services/glossary-mention-scanner.ts` | 신규 Markdown scanner |
| `src/services/glossary-mention-scanner.test.ts` | 제외 subtree 테스트 |
| `src/infra/db/repositories/GlossaryRepository.ts` | mention read·write |
| `src/services/GlossarySyncService.ts` | 역참조 갱신 |
| `src/services/GlossaryService.ts` | 렌더·페이지 조회 service |
| `src/services/index.ts` | service factory export |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog/.claude/worktrees/plan054-glossary-tooltip
# branch: feat/plan054-glossary-tooltip
pnpm test src/lib/glossary-matcher.test.ts src/services/glossary-mention-scanner.test.ts src/services/GlossarySyncService.test.ts
pnpm type-check
rg -n "heading|linkReference|inlineCode|inlineMath|Mermaid" src/services/glossary-mention-scanner.test.ts
```

기대값:

- 테스트와 type-check exit code가 0이다.
- 마지막 `rg`가 제외 영역별 회귀 case를 출력한다.

## 의도 메모 (왜)

- 런타임 SQL `LIKE`는 alias, 제외 subtree, 긴 표현 우선 정책을 재현하지 못하므로 사용하지 않는다.
- matcher가 렌더와 index의 단일 소스이며 traversal adapter만 HAST와 Markdown AST로 나눈다.
- BLG15를 피하도록 repository projection과 service 반환 타입을 정확히 맞춘다.
