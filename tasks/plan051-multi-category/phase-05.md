# Phase 05 — 통합 검증 + 정합 grep + completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

plan051 전체(phase 01~04)를 통합 검증하고, 각 레이어에 categories 가 배선됐는지 grep 으로 확인한 뒤 index.json 을 완료 처리한다.

**선행**: phase-01~04 완료.

---

## 작업 항목 (3)

### 1. 전체 빌드·테스트 통과

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm build
pnpm test --run
```

모두 통과해야 한다. 실패 시 해당 phase 로 되돌려 원인을 고친다.

### 2. 레이어별 배선 + 정합 grep

```bash
# cwd: <repo root>
# 스키마·타입 (각 1건 이상)
grep -c "categories" src/infra/db/schema/posts.ts
grep -c "categories" src/infra/db/types.ts

# sync 저장 — full + incremental 양쪽
grep -n "export function mergeCategories" src/services/PostSyncService.ts
grep -n "parseFrontMatter" src/services/PostSyncService.ts          # 증분 경로 frontmatter 파싱
grep -c "categories: mergeCategories" src/services/SyncService.ts   # full sync update+create

# 카테고리 페이지 cross-post 배선
grep -n "getCrossCategoryPosts" src/infra/db/repositories/PostRepository.ts
grep -n "getCrossCategoryPosts" src/app/category/\[...path\]/page.tsx
grep -n "JSON_CONTAINS" src/infra/db/repositories/PostRepository.ts

# 배지 UI
grep -rn "categories?.length\|categories.map\|cats.map" src/components/PostCard.tsx

# 정합 가드 — getCategoryStats 는 categories 미포함 유지(groupBy 보호, exit: 0 기대)
grep -A8 "async getCategoryStats" src/infra/db/repositories/PostRepository.ts | grep -c "categories: posts.categories"
```

### 3. index.json 완료 마킹

`tasks/plan051-multi-category/index.json` 의 최상위 `status` 를 `"completed"` 로, 모든 phase 의 `status` 를 `"completed"` 로 바꾼다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `tasks/plan051-multi-category/index.json` | 수정 — status completed |

## 검증

```bash
# cwd: <repo root>
grep -c '"status": "completed"' tasks/plan051-multi-category/index.json   # 6 기대(최상위 1 + phase 5)
```

수동 smoke (`pnpm dev`, MySQL + 로컬 sync):
- 단일 카테고리 기존 글이 기존과 동일하게 보이는지(회귀 0)
- `AI/...` 글에 `categories: [DevOps]` 추가 후 `/category/DevOps` 에 cross-post 노출 + 카드/검색/상세에 다중 배지

## 의도 메모 (왜)

- build + test + 배선 grep 을 한 phase 로 묶어 plan 종료 점검으로 삼는다.
- 기존 단일 카테고리 글의 회귀 0 을 마지막에 반드시 확인 — backfill(phase-01) + primary 유지(phase-02/04) + cross-post 가 폴더 밖만(phase-03)이라 출시 시점 변화가 없어야 한다.
- `getCategoryStats` 가 categories 를 select 하지 않는지 확인 — groupBy 집계에 끼면 런타임 `ONLY_FULL_GROUP_BY` 오류(빌드 통과, 런타임 폭발).
