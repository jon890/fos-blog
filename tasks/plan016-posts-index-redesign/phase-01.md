# Phase 01 — PostsListSubHero + latest/popular 헤더 교체 + InfiniteList 버튼 토큰화

**Model**: sonnet
**Status**: pending

---

## 목표

`/posts/latest` 와 `/posts/popular` 인덱스 페이지의 톤을 plan013 (HomeHero) + plan010 (PostCard) 와 통일한다. 글 상세(plan011) 와 홈(plan013) 사이의 중간 무게감 sub-hero 패턴을 도입하고, PostsInfiniteList 의 잔존 legacy gray/red/blue Tailwind 유틸리티를 디자인 토큰으로 교체한다.

**시각 의도**: 홈 (mesh + 강한 hero) → 인덱스 (가벼운 sub-hero, mesh 없음) → 글 상세 (ArticleHero) 로 정보 위계 차등.

**범위 외**: PostCard 자체 (plan010 이미 완료), 글 상세 (plan011 완료), Categories (plan015 별도). 인덱스 헤더 + 본문 컨테이너 폭 + InfiniteList UI 만.

---

## 작업 항목 (4)

### 1. `src/components/PostsListSubHero.tsx` 신규

새 server component. props:

```ts
interface PostsListSubHeroProps {
  eyebrow: string;              // 예: "INDEX · LATEST" / "INDEX · POPULAR"
  title: string;                 // 예: "최신 글" / "인기 글"
  meta: string;                  // 예: "업데이트 순" / "방문수 순 · 누적 N회"
  accent?: "default" | "popular"; // popular 면 Flame icon 우측 표시
}
```

레이아웃 (HomeHero 와 동일한 토큰·간격 룰):
- 컨테이너 wrapper 는 페이지에서 제공 (이 컴포넌트는 inner block)
- eyebrow: `font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-fg-muted)]` + 1px brand line prefix (`h-px w-6 bg-[var(--color-brand-400)]`) — HomeHero 의 `hero-eyebrow` 와 동일 패턴
- h1: `mt-4 text-[28px] md:text-[40px] font-semibold leading-[1.1] tracking-tight text-[var(--color-fg-primary)]` (HomeHero 보다 한 단계 작음 — 36/64 → 28/40)
- meta: `mt-3 font-mono text-[12px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)]` (단일 라인)
- accent="popular" 일 때 h1 우측에 `<Flame>` lucide 아이콘 (h-6 md:h-7) — color `var(--color-cat-system)` (orange tone). h1 과 같은 baseline 으로 `inline-flex items-center gap-3`
- 하단 1px divider: `mt-8 h-px bg-[var(--color-border-subtle)]` (본문과 분리)

Mesh / SVG 배경 **없음** — 의도적으로 가볍게.

### 2. `src/app/posts/latest/page.tsx` — 헤더 + 컨테이너 교체

수정:
- 컨테이너: `max-w-3xl` → `max-w-[1180px]` (홈 톤 일관)
- 기존 인라인 헤더 (`<div className="mb-8">...최신 글...업데이트 순...`) 삭제
- `<PostsListSubHero eyebrow="INDEX · LATEST" title="최신 글" meta="업데이트 순" />` 로 교체
- import: `import { PostsListSubHero } from "@/components/PostsListSubHero";`

PostsInfiniteList 와 BackToTopButton 은 그대로.

### 3. `src/app/posts/popular/page.tsx` — 헤더 + 컨테이너 교체

수정:
- 컨테이너: `max-w-3xl` → `max-w-[1180px]`
- 기존 인라인 헤더 (Flame icon + 인기 글 + 방문수 순) 삭제 — Flame 처리는 PostsListSubHero 의 `accent="popular"` 에서 담당
- `<PostsListSubHero eyebrow="INDEX · POPULAR" title="인기 글" meta="방문수 순" accent="popular" />` 로 교체
- 기존 `import { Flame } from "lucide-react"` 제거 (PostsListSubHero 내부로 이동)

### 4. `src/components/PostsInfiniteList.tsx` — 버튼·종료 메시지 토큰화

기존 legacy 유틸리티 → 토큰 교체:

**"더 보기" 버튼** (idle 상태, 라인 132–137):
- `bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700` →
- `bg-[var(--color-bg-elevated)] text-[var(--color-fg-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg-primary)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)]`
- `focus-visible:ring-blue-500` → `focus-visible:ring-[var(--color-brand-400)]`
- `rounded-xl` → `rounded-lg` (PostCard / CategoryCard 와 동일)
- 폰트: `font-mono text-[12px] uppercase tracking-[0.06em]` 추가 — 키 패턴 통일

**"재시도" 버튼** (error 상태, 라인 121–128):
- 기본 셸은 위 "더 보기" 와 동일 (rounded-lg + border + mono uppercase)
- 다만 의미 강조 위해 `text-[var(--color-error)]` (또는 fallback `text-[oklch(0.65_0.21_27)]`) + hover bg 만 살짝 강조 — gaudy 한 red-100 bg 는 제거
- focus ring 도 brand-400 통일

**"더 이상 글이 없습니다" 종료 메시지** (라인 141–143):
- `text-sm text-gray-500 dark:text-gray-400` →
- `font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-fg-muted)]`
- 메시지 옆 `· END` 같은 mono 마커 추가는 선택 (간결성 우선 — 그대로 두어도 됨)

**Skeleton 영역** (loading 상태): PostCardSkeleton 그대로 — 별도 변경 없음.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/components/PostsListSubHero.tsx` | 신규 — eyebrow + h1 + meta + 선택 Flame accent |
| `src/app/posts/latest/page.tsx` | 헤더 인라인 → PostsListSubHero, 컨테이너 1180px |
| `src/app/posts/popular/page.tsx` | 헤더 인라인 → PostsListSubHero accent="popular", Flame import 제거, 컨테이너 1180px |
| `src/components/PostsInfiniteList.tsx` | 더 보기 / 재시도 / 종료 메시지 토큰화 |

## 검증

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# legacy color 잔재 확인 (인덱스 페이지 한정)
! grep -nE "text-gray-(900|700|500|400)|bg-gray-(100|800)|text-blue-500|bg-red-100" \
    src/app/posts/latest/page.tsx \
    src/app/posts/popular/page.tsx \
    src/components/PostsInfiniteList.tsx \
    src/components/PostsListSubHero.tsx

# 신규 컴포넌트 토큰 사용 확인
grep -n "var(--color-brand-400)" src/components/PostsListSubHero.tsx
grep -n "var(--color-fg-primary)" src/components/PostsListSubHero.tsx
```

수동 smoke (`pnpm dev`):
- `/posts/latest` — eyebrow `INDEX · LATEST`, h1 "최신 글", meta "업데이트 순" mono, 1180px 컨테이너에 PostCard 리스트
- `/posts/popular` — eyebrow `INDEX · POPULAR`, h1 "인기 글" 옆 Flame icon (system tone), meta "방문수 순"
- 다크/라이트 토글 — 토큰 모두 양 모드 대응
- 무한 스크롤 더 보기 / 종료 메시지 톤 변화 확인
- Lighthouse — Performance ≥ 90, Accessibility ≥ 95 (CI 자동 검증)

## 산출물

- 신규 컴포넌트 1개 (`PostsListSubHero`)
- 페이지 2개 헤더·컨테이너 교체
- InfiniteList UI 토큰화
- 컴포넌트 / 페이지 별 atomic commit (4개) — `commit-and-push` 스킬 룰

## 의도 메모 (왜)

- HomeHero 와 ArticleHero 사이에 중간 무게의 헤더 패턴이 필요. 인덱스 = 카테고리·정렬 정보가 핵심이지 hero 자체가 콘텐츠는 아님 → mesh 없이 eyebrow + h1 만으로 충분
- 1180px 컨테이너는 plan013 에서 정한 사이트 표준. 인덱스만 max-w-3xl 로 좁히면 화면 좌우 여백이 비대칭 — 폭 통일이 우선
- legacy gray-100/red-100 버튼 셸은 plan009 토큰 도입 전 잔재. 이번에 정리하지 않으면 다음 plan 에서 다시 grep 해야 함
