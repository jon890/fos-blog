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

### 3. `src/components/CategoryList.tsx` grid 점검 (변경 가능성 낮음)

현재 `CategoryList.tsx` 는 이미 `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` 적용됨 — **3×3 grid 자연스럽게 형성, 변경 불필요**. 수정 항목으로 두는 이유는 `md:grid-cols-3` 추가 여부 (현재 sm→lg 점프) 정도의 미세 조정 가능성. 실제 시각 점검 후 어색하지 않으면 변경 0.

기존 카드 비율이 너무 wide 해 보이면 cell aspect 조정 검토 (OOS — 기존 톤 유지가 기본).

### 4. 마지막 섹션 (카테고리) margin/spacing 조정

기존 마지막 섹션 (Recent posts) 는 `<section>` 그대로 끝 — bottom margin 없음. 카테고리가 새 마지막이 되면 bottom margin 점검 — 페이지 푸터와 자연스러운 간격.

### 5. Empty state 처리

기존 popular/recent 의 conditional 렌더 로직 (`length > 0`) 그대로 유지. **카테고리 섹션도 동일한 가드 추가** — `categories.length > 0 && (<section>...)` 로 빈 배열일 때 헤더만 노출되는 어색함 차단. (PR #122 review-fix 반영)

### 6. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 섹션 순서 — popularPosts JSX 가 CategoryList JSX 보다 위에 위치
# 주의: 단순 indexOf("CategoryList") 는 import 라인을 잡아 false positive 발생 — JSX 태그 패턴으로 비교
node -e "const s = require('fs').readFileSync('src/app/page.tsx','utf8'); const a = s.indexOf('popularPosts.length > 0 &&'); const b = s.indexOf('<CategoryList categories'); process.exit(a > 0 && b > 0 && a < b ? 0 : 1)"

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
