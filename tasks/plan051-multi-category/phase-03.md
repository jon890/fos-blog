# Phase 03 — 카테고리 조회를 categories(JSON_CONTAINS) 기준으로 확장

**Model**: sonnet
**Status**: pending

---

## 목표

카테고리별 글 조회를 단일 `category` 일치에서 다중 `categories` 포함(`JSON_CONTAINS`)으로 바꾼다.
한 글이 자신의 모든 카테고리 페이지에 노출되게 한다 (ADR-030).
카테고리별 글 수 집계(postCount)도 다중 기준으로 맞춘다.

**선행**: phase-01(컬럼), phase-02(저장 + select 포함).
**범위 외**: UI 배지(phase-04), 연관 글(getRelatedPosts — 별도 후속 plan).

---

## 작업 항목 (4)

### 1. `src/infra/db/repositories/PostRepository.ts` — getPostsByCategory 를 JSON_CONTAINS 로

현재 `where(and(eq(posts.category, category), eq(posts.isActive, true)))` 를 categories 포함 조건으로 바꾼다. `tags` 가 `JSON_CONTAINS` 를 쓰는 기존 패턴(ADR-023)을 같은 repo/코드베이스에서 찾아 동일 방식으로 작성한다.

```ts
import { sql } from "drizzle-orm";
// where 조건:
and(
  sql`JSON_CONTAINS(${posts.categories}, ${JSON.stringify(category)})`,
  eq(posts.isActive, true),
)
```

`JSON.stringify("AI")` → `"AI"` 가 되어 `JSON_CONTAINS(categories, '"AI"')` 로 평가된다.

### 2. getPostsByCategory 호출자 확인

이 메서드를 호출하는 곳(category 페이지·service)이 다중 전환 후에도 동작하는지 확인한다.

```bash
# cwd: <repo root>
grep -rn "getPostsByCategory" src/ | grep -v test
```

호출자가 category 문자열을 넘기는 방식이면 시그니처 변경이 없으므로 추가 수정 불필요하다. 시그니처를 바꿨다면 호출부도 함께 고친다.

### 3. 카테고리 글 수 집계 다중화

카테고리별 postCount 를 집계하는 로직을 찾아, 단일 `category` 가 아닌 `categories` 포함 기준으로 센다(한 글이 여러 카테고리에 +1).

```bash
# cwd: <repo root>
grep -rn "postCount\|post_count\|getCategor" src/services/ src/infra/db/repositories/ | grep -v test
```

집계 위치(MetadataSyncService 또는 CategoryRepository 등)를 특정해, 단일 category GROUP BY 를 categories 기준 집계로 바꾼다. 정확한 위치는 위 grep 결과로 판단한다.

### 4. 폴더 트리/경로 기반 조회는 변경 없음 확인

`/category/[...path]` 의 폴더 계층 탐색(FolderRepository·folders 컬럼 기반)은 경로 개념이라 다중 카테고리와 무관하다. 이 phase 에서 건드리지 않는다 — grep 으로 폴더 트리 로직이 categories 와 섞이지 않았는지만 확인한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/infra/db/repositories/PostRepository.ts` | 수정 — getPostsByCategory JSON_CONTAINS |
| 글 수 집계 파일 (grep 으로 특정) | 수정 — categories 기준 집계 |

## 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run

grep -n "JSON_CONTAINS" src/infra/db/repositories/PostRepository.ts   # getPostsByCategory 전환 확인
! grep -n "eq(posts.category, category)" src/infra/db/repositories/PostRepository.ts   # 단일 eq 잔재 없어야(exit 1 기대)
```

수동 smoke (`pnpm dev`, MySQL + 로컬 sync 필요):
- `/category/AI` — AI 카테고리 글 노출 확인
- frontmatter 에 `categories: [DevOps]` 를 넣은 테스트 글이 `/category/DevOps` 와 `/category/<경로폴더>` 양쪽에 나타나는지

## 의도 메모 (왜)

- getRelatedPosts 는 의도적으로 제외 — 다중 카테고리 기반 연관 글은 별도 후속 plan(사용자 합의). 이 phase 는 "카테고리 페이지 노출"에 한정한다.
- 폴더 트리(경로)와 카테고리(다중 소속)는 서로 다른 축이므로 섞지 않는다 — 혼선 시 한 글이 잘못된 폴더에 뜨는 회귀가 생긴다.
