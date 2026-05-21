# Phase 03 — Header navLink + 메인 페이지 시리즈 섹션

**Model**: sonnet
**Goal**: 전역 Header navigation 에 시리즈 항목 추가 + 메인 페이지 (`/`) 에 "시리즈" 섹션 신설.

## Context (자기완결)

- phase-01 에서 `PostRepository.getAllSeries(limit?)` 사용 가능
- phase-02 에서 `SeriesCard` 컴포넌트 사용 가능
- Header (`src/components/Header.tsx`) 의 `navLinks` 배열 (현재 라인 48-51) 에 항목 추가
- 메인 페이지 (`src/app/page.tsx`) 의 섹션 순서: HomeHero → Popular Posts → Recent Posts → Categories
  - plan047 결정: **인기 글 ↓ 시리즈 ↓ 최근 글** 순서 (시리즈는 발견성 향상이라 인기 직후)

**기존 참조**:
- `SectionCTAButton` (`src/components/SectionCTAButton.tsx`) — "X 더 보기 →" 버튼
- 기존 메인 페이지 섹션 구조 — `<section className="mb-8 md:mb-16">` + 헤더 + grid + CTA

## 작업 항목

### 1. Header navLink 추가

`src/components/Header.tsx` 의 `navLinks` 배열 수정:

```tsx
import { Book, Github, Home, Layers, Menu, X, Search, PanelLeft } from "lucide-react";

// ...

const navLinks = [
  { href: "/", label: "01 / 홈", icon: Home },
  { href: "/categories", label: "02 / 카테고리", icon: Book },
  { href: "/series", label: "03 / 시리즈", icon: Layers },
];
```

`Layers` 아이콘 lucide-react import 추가 — 시리즈/계층 의미에 적합 (BookOpen 도 후보였으나 카테고리 Book 과 시각 중복 위험).

`isActive` 함수는 기존 로직 (`pathname.startsWith(href)`) 그대로 — `/series` 와 `/series/<name>` 모두 활성 표시.

### 2. 메인 페이지 시리즈 섹션 추가

`src/app/page.tsx` 수정:

#### 2a. data fetch 확장

기존 `Promise.all` 배열에 `post.getAllSeries(4)` 추가:

```tsx
let seriesList: SeriesInfo[] = [];

// ...
[categories, recentPosts, popularPosts, postCountTotal, seriesCount, seriesList] = await Promise.all([
  category.getCategories(),
  post.getRecentPosts(6),
  getPopularPosts(6),
  post.getActivePostCount(),
  post.countSeries(),
  post.getAllSeries(4),
]);
```

import 추가:

```tsx
import { SeriesCard } from "@/components/SeriesCard";
import type { SeriesInfo, CategoryData, PostData } from "@/infra/db/types";
```

`src/app/page.tsx` 의 기존 lucide-react import 확장 (현재 `ArrowRight, Flame` 만):

```tsx
import { ArrowRight, Flame, Layers } from "lucide-react";
```

#### 2b. JSX 섹션 추가

기존 Popular Posts 섹션 닫는 `</section>` 직후, Recent Posts 섹션 열기 전에 삽입:

```tsx
{/* Series Section */}
{seriesList.length > 0 && (
  <section className="mb-8 md:mb-16">
    <div className="flex items-center gap-2 mb-4 md:mb-8">
      <Layers className="w-6 h-6 text-[var(--color-brand-400)]" />
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
        시리즈
      </h2>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {seriesList.map((s) => (
        <SeriesCard key={s.name} series={s} />
      ))}
    </div>
    <SectionCTAButton href="/series" label="시리즈 더 보기" />
  </section>
)}
```

`Layers` 아이콘 import 도 `lucide-react` import 에 추가.

### 3. 자동 verification

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm lint
pnpm type-check

# navLinks 항목 확인
grep -n "/series" src/components/Header.tsx
grep -n "Layers" src/components/Header.tsx

# 메인 페이지 섹션 + data fetch 확인
grep -n "getAllSeries\|SeriesCard" src/app/page.tsx
grep -n "시리즈 더 보기" src/app/page.tsx
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/components/Header.tsx` | 수정 (navLink + Layers import) |
| `src/app/page.tsx` | 수정 (data fetch + 섹션 JSX + import) |

## Out of Scope

- HomeHero seriesCount 를 클릭 가능 링크로 변환 — 현재는 통계 표시 의도 유지 (별 plan 후보)
- mobile menu 네비 패널의 시리즈 항목 — Header `navLinks` 가 desktop / mobile 양쪽에서 동일 배열 사용한다면 자동 반영. 별도 mobile 전용 array 가 있으면 phase 안에서 함께 갱신
- 메인 페이지 layout 의 큰 재배치 — 본 phase 는 "인기 글 다음 위치" 한 곳만 추가

## Risks

| 리스크 | 완화 |
|---|---|
| `seriesList.length === 0` 인 환경에서 섹션 숨김 처리 누락 → 빈 grid 노출 | JSX 의 `{seriesList.length > 0 && ...}` 가드. 본 phase 자체 verification 에서 `seriesList=[]` 케이스 type-check 만으로는 안 잡힘 → phase-04 의 dev server 부팅 + cmux browser 확인 시 검증 |
| Header `isActive` 가 `/` 가 모든 path 의 prefix 라 항상 활성화될 위험 | 기존 isActive 함수의 `href === "/"` 분기 (`pathname === "/"`) 가 이미 처리. 시리즈는 prefix match 로 충분 |
| Layers 아이콘이 카테고리 Book 과 시각 충돌 | lucide-react 의 Layers 는 사각형 stack 형태로 Book 과 충분히 구분됨. 디자인 회귀 우려 시 phase-04 에서 cmux browser 시각 확인으로 판단 |
| 메인 페이지 첫 로딩 시 Promise.all 의 getAllSeries(4) 가 추가 쿼리 비용 → ISR 60s 안에서 acceptable | getAllSeries 는 2 쿼리, ISR cache 가 있어 매 요청 호출 아님. 부담 적음 |
