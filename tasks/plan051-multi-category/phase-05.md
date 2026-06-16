# Phase 05 — 통합 검증 + legacy 잔재 grep + completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

plan051 전체(phase 01~04)를 통합 검증하고, 단일 category 가정이 남은 잔재를 grep 으로 확인한 뒤 index.json 을 완료 처리한다.

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

### 2. legacy 잔재 + 적용 확인 grep

```bash
# cwd: <repo root>
# categories 가 각 레이어에 반영됐는지(각 1건 이상)
grep -c "categories" src/infra/db/schema/posts.ts
grep -c "categories" src/infra/db/types.ts
grep -n "JSON_CONTAINS" src/infra/db/repositories/PostRepository.ts
grep -rn "mergeCategories" src/services/ | grep -v test

# 단일 category 일치 조회 잔재가 없어야(exit 1 기대)
! grep -n "eq(posts.category, category)" src/infra/db/repositories/PostRepository.ts
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
- 단일 카테고리 기존 글이 기존과 동일하게 보이는지(회귀 없음)
- `categories` frontmatter 를 넣은 글이 여러 카테고리 페이지에 노출 + 배지 다중 표시

## 의도 메모 (왜)

- build + test + 잔재 grep 을 한 phase 로 묶어 plan 종료 게이트로 삼는다.
- 기존 단일 카테고리 글의 회귀 여부를 마지막에 반드시 확인 — backfill(phase-01)과 primary 유지(phase-02/04)가 함께 동작해야 회귀 0 이다.
