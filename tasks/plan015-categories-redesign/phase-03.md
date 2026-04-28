# Phase 03 — 통합 검증 + legacy 잔재 grep + Lighthouse smoke

**Model**: haiku
**Status**: pending

---

## 목표

phase 01 + 02 의 통합 점검. 기계적 검증 위주 — 새 코드 추가 없음.

---

## 작업 항목 (3)

### 1. legacy Tailwind 잔재 grep + 빌드 검증

```bash
# Categories 영역 전체에 legacy gray-* / blue-* 잔재 없음
! grep -rnE "text-gray-(900|700|500|400)|bg-gray-(100|200|800)|bg-blue-(100|500)|text-blue-(400|500|600)|bg-white(?! /)" \
    src/app/categories/ \
    src/app/category/ \
    src/components/Categor* \
    src/components/Breadcrumb.tsx \
    src/components/SubfolderCard.tsx \
    src/components/PostListRow.tsx \
    src/components/ReadmeFrame.tsx

# 기존 CategoryList.tsx 가 어디서도 import 되지 않으면 삭제
grep -rn "from \"@/components/CategoryList\"\|from \"./CategoryList\"" src/ ; echo "exit=$?"
# exit=1 (no match) 면 src/components/CategoryList.tsx 삭제

# 빌드
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

`pnpm build` 결과:
- 빌드 산출물에 신규 카테고리 컴포넌트 포함:
  ```bash
  grep -rE "CategoriesSubHero|CategoryDetailSubHero|SubfolderCard|PostListRow|ReadmeFrame" .next/server/app/categor* 2>/dev/null | head -3
  ```
- `.next` 빌드 시 chunk 사이즈 회귀 없음 (홈 페이지 first-load JS 가 plan013 베이스라인 ±5KB)

### 2. 수동 smoke + Lighthouse

`pnpm dev` 로:

- `/categories` 인덱스
  - top-3 featured 카드: 실제 DB 의 postCount desc 정렬 — 데이터 비어있으면 sublines `0 주제 / 0 글` 표시 (graceful)
  - 6 (또는 N-3) 일반 카드 grid
  - hover blob radial gradient — light/dark 모두 옅게
  - breadcrumb home icon 표시
- `/category/Java` (1단)
  - eyebrow `JAVA`, sub-hero tinted (좌 border + 5% gradient)
  - sub-hero subline `N 폴더 · M 글 · category/Java`
  - 하위 폴더 / 글 섹션
- `/category/Java/Spring` (2단)
  - eyebrow `JAVA · SPRING`
  - breadcrumb 4단 chain
  - 만약 README 가 있으면 ReadmeFrame 렌더, 없으면 섹션 자체 노출 안 됨
  - PostListRow hover 좌 border + bg cat-color 4%
- 다크/라이트 토글 양 모드 동작
- 모바일 (DevTools 375px): 폴더/카테고리 grid 1-col

**Lighthouse 자동 검증**: `.github/workflows/lighthouse.yml` CI 가 PR 단위 실행. Performance ≥ 90, Accessibility ≥ 95 임계 자동 차단 (ADR-017 합의).

### 3. SEO + JSON-LD 회귀 점검

`/category/[...path]` 의 기존 `BreadcrumbJsonLd` 가 그대로 동작하는지 view-source 로 확인. 새 Breadcrumb 컴포넌트는 시각 표시만, JSON-LD 는 별도 — 영향 없음 예상이지만 phase 02 변경 후 누락 가능성 차단.

```bash
# 빌드 산출물에 JSON-LD 포함
grep -rE "@context.*schema.org.*BreadcrumbList" .next/server/app/category/ 2>/dev/null | head -1
```

`/categories` 인덱스 페이지의 기존 metadata (canonical, og:image) 도 그대로 유지 확인 — phase 01 에서 metadata export 안 건드림.

---

## Critical Files

이 phase 는 코드 변경 없음. 검증 + 잔재 정리만:
- 기존 `src/components/CategoryList.tsx` — 사용처 없으면 삭제 후 commit (atomic)
- 기존 `src/app/categories/opengraph-image.tsx` — 그대로 유지

## 검증

위 1~3 모두 통과해야 plan 완료. Lighthouse 점수 회귀 시 phase 01/02 로 회귀 — 관련 컴포넌트 (radial blob, gradient bg) 가 paint cost 큰 후보.

## 의도 메모

- **별도 phase 분리** 이유: phase 01/02 가 컴포넌트 + 페이지 변경으로 작업 항목 5개 한도 근접. 검증 + 잔재 정리는 모델·시간 절약 위해 haiku 로 분리
- **CategoryList 삭제** 이유: phase 01 에서 `/categories/page.tsx` 가 더이상 import 안 함. 다른 사용처 없으면 dead code — atomic commit 으로 정리
