# Phase 01 — 홈 섹션 순서 변경 + 카테고리 9개

**Model**: sonnet
**Goal**: `/` 홈 페이지의 섹션 순서를 인기 → 최신 → 카테고리 로 재배열 + 카테고리 노출 6 → 9개 + grid 3×3 조정.

## Context (자기완결)

`src/app/page.tsx` 의 현재 구조:
1. `<HomeHero />`
2. Categories section (`<CategoryList categories={categories.slice(0, 6)} />`)
3. Popular section (`popularPosts.length > 0 && ...`)
4. Recent section (`recentPosts.length > 0 ? ... : empty`)

`src/infra/db/repositories/CategoryRepository.ts:31` 의 `getCategories()` 는 이미 `postCount desc` 정렬.

## 작업 항목

### 1. `src/app/page.tsx` 섹션 재배열

JSX 트리에서 Popular → Recent → Categories 순서로 재배치. 각 section 의 `<h2>` / spacing / wrapper className 은 그대로.

### 2. 카테고리 노출 6 → 9

```tsx
<CategoryList categories={categories.slice(0, 6)} />
//                                          ^^^^
// → 9
<CategoryList categories={categories.slice(0, 9)} />
```

### 3. `src/components/CategoryList.tsx` grid 조정

기존 grid (PostCard 와 비슷한 패턴) 를 3×3 으로:
- 모바일: `grid-cols-2` (2 × 5 → 마지막 1개는 단독)
- 태블릿: `md:grid-cols-3` (3 × 3)
- 데스크톱: `lg:grid-cols-3` (3 × 3)

CategoryList 를 먼저 grep 으로 확인 후 결정. 만약 현재 `lg:grid-cols-2` 라면 `lg:grid-cols-3` 로 교체. 기존 카드 비율이 너무 wide 해 보이면 cell aspect 도 조정 검토 (OOS — 기존 톤 유지가 기본).

### 4. 마지막 섹션 (카테고리) margin/spacing 조정

기존 마지막 섹션 (Recent posts) 는 `<section>` 그대로 끝 — bottom margin 없음. 카테고리가 새 마지막이 되면 bottom margin 점검 — 페이지 푸터와 자연스러운 간격.

### 5. Empty state 처리

기존 popular/recent 의 conditional 렌더 로직 (`length > 0`) 그대로 유지. 카테고리 빈 배열 (`categories.length === 0`) 일 때 섹션 자체 hide 또는 placeholder — 기존 동작 유지.

### 6. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 섹션 순서 — popularPosts JSX 가 categories JSX 보다 위에 위치
node -e "const s = require('fs').readFileSync('src/app/page.tsx','utf8'); const a = s.indexOf('popularPosts.length'); const b = s.indexOf('CategoryList'); process.exit(a < b ? 0 : 1)"

# 9 cap
grep -n "categories\.slice(0, 9)" src/app/page.tsx
! grep -n "categories\.slice(0, 6)" src/app/page.tsx

# CategoryList grid 3 columns
grep -nE "lg:grid-cols-3|md:grid-cols-3" src/components/CategoryList.tsx
```

수동 smoke:
- `pnpm dev` → 홈 진입 → 시각 순서 확인 (Hero → Popular → Recent → Categories)
- 모바일 (375px) / 태블릿 (768px) / 데스크톱 (1180px) breakpoint 확인
- 카테고리 9개 표시 (DB 가 9개 미만이면 그만큼만)

### 7. `docs/pages/home.md` 갱신

기존 home.md 의 섹션 순서 / 카테고리 개수 기록 1~2줄 갱신.

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/app/page.tsx` | 수정 (JSX 순서 + slice 인자) |
| `src/components/CategoryList.tsx` | 수정 (grid columns) |
| `docs/pages/home.md` | 수정 (섹션 순서 / 카테고리 개수) |

## Out of Scope

- /categories 인덱스 페이지 변경
- 카테고리 카드 디자인 (plan015 결과 유지)
- 인기/최신 글 표시 개수 (현재 6개 유지)
- 섹션 간 motion / scroll reveal — plan025 motion polish 와 별개

## Risks

| 리스크 | 완화 |
|---|---|
| DB 카테고리 수가 9개 미만일 때 grid 빈 cell | `slice(0, 9)` 가 자동 truncate — 빈 cell 안 생김. css grid 가 자연스럽게 가용 cell 만 채움 |
| md/lg breakpoint 에서 3 cols 가 어색해 보일 수 있음 | 시각 smoke 후 필요시 lg:grid-cols-3 → lg:grid-cols-4 fallback 결정 (이번 phase OOS, 후속 review-fix) |
