# Phase 01 — category-meta 헬퍼 + PostCard (row+grid) + CategoryCard + SectionCTAButton 리디자인 + 검증

## 컨텍스트 (자기완결 프롬프트)

plan009 (design tokens foundation) 머지 완료를 전제로, Claude Design Round 2 컴포넌트 mockup 의 **Card List variants (Editorial row list / Card grid)** 패턴을 fos-blog 코드에 적용. 시각 영향 최소였던 plan009 와 달리 이번 plan 은 **명백한 시각 변화** — 홈/카테고리 페이지의 PostCard, CategoryCard, SectionCTAButton 모양이 모두 바뀐다.

추가로 카테고리 키 정규화 헬퍼를 도입해 plan009 의 9개 canonical category(`ai/algorithm/db/devops/java/js/react/next/system`) 와 실제 데이터의 키들 (architecture/network/interview/kafka/internet/finance/git/go/html/http/redis/resume/css/기술공유 등) 사이를 매핑한다 — 누락 키는 모두 `system` 으로 흡수.

> **Terminal feed variant 는 이번 phase 제외.** 후속 plan 으로 분리.

## 먼저 읽을 문서

- `docs/adr.md` — **ADR-017** (디자인 시스템 결정), ADR-008 (카테고리 4-tier)
- `docs/design-inspiration.md` — Round 2 컴포넌트 mockup 메모
- `src/app/globals.css` — plan009 가 정의한 `@theme` 토큰 (`--color-cat-*`, `--color-fg-*`, `--color-border-*`, `--font-mono`)
- `src/infra/db/constants.ts` — 기존 `categoryIcons` (21 keys: AI/algorithm/architecture/database/devops/finance/git/go/html/http/internet/interview/java/javascript/kafka/network/react/redis/resume/css/기술공유)
- `src/infra/db/types.ts` — `PostData`, `CategoryData` 타입
- `.claude/skills/_shared/common-critic-patterns.md` — 시드 7 패턴 self-check

## 사전 게이트

```bash
# cwd: <worktree root>

# 1) plan009 머지 완료 확인 (토큰 + 폰트 + shadcn)
grep -n -- "--color-cat-system" src/app/globals.css
grep -n "geist/font/sans" src/app/layout.tsx
test -f src/components/ui/button.tsx
test -f src/lib/utils.ts

# 2) 기존 컴포넌트 위치
test -f src/components/PostCard.tsx
test -f src/components/PostCardSkeleton.tsx
test -f src/components/CategoryCard.tsx
test -f src/components/SectionCTAButton.tsx
```

위 4개 중 어느 하나라도 실패하면 **PHASE_BLOCKED: plan009 선행 필요**.

## Round 2 mockup 추출

```bash
# cwd: <worktree root>
tar xzOf ~/.claude/projects/-Users-nhn-personal-fos-blog/d11b8756-7896-451b-932e-0678c2241d67/tool-results/webfetch-1777098410179-5850mb.bin 'fos-blog/project/components-1.jsx' > /tmp/components-1.jsx
tar xzOf ~/.claude/projects/-Users-nhn-personal-fos-blog/d11b8756-7896-451b-932e-0678c2241d67/tool-results/webfetch-1777098410179-5850mb.bin 'fos-blog/project/components.css' > /tmp/components.css
```

`/tmp/components-1.jsx` 의 `CardListRows` (Editorial), `CardListGrid` (Grid) 함수 + `/tmp/components.css` 의 `.list-row`, `.post-card`, `.cards-shell`, `.cards-head` 섹션이 source of truth. Terminal (`CardListTerminal`, `.term-list`) 은 무시.

## 컴포넌트 매핑 테이블

| Round 2 mockup | fos-blog 대상 | 변경 |
|---|---|---|
| `.list-row` (5열 grid: num / body[title+ex] / cat-row / meta) | `PostCard.tsx` 기본 변형 (`variant="row"`) | 완전 재구성 |
| `.post-card` + `.card-grid` (커버 SVG + body) | `PostCard.tsx` 옵션 변형 (`variant="grid"`) | 신규 옵션 prop |
| `.cards-shell` 의 `.pill` | `SectionCTAButton.tsx` | 둥근 파란 → mono pill 톤 |
| (mockup 없음 — list-row 톤 유지) | `CategoryCard.tsx` | cat-color 좌측 막대 + mono meta + folder removal |
| `.post-card-cat .dot` 의 `--cat-color` | `src/lib/category-meta.ts` 신규 | 카테고리별 oklch hue 매핑 |

## 카테고리 정규화 표 (`category-meta.ts` 의 source of truth)

```
canonical (9)        | hue (oklch)  | 흡수되는 raw key
---------------------+--------------+---------------------------------------------
ai                   | 285          | AI
algorithm            | 25           | algorithm
db                   | 55           | database, redis
devops               | 145          | devops
java                 | 180          | java
js                   | 90           | javascript, html, css
react                | 220          | react
next                 | 0            | (현재 raw key 없음 — 향후 next 글 대비)
system               | 250          | architecture, network, interview, kafka,
                                    | internet, finance, git, go, http, resume,
                                    | 기술공유, 그 외 모든 미매핑 키
```

> **결정 근거**: 사용자 prompt 에 "architecture/network/interview/kafka/internet → system/default" 명시. js 그룹 확장(html/css) 과 db 그룹 확장(redis) 은 의미 인접성으로 헬퍼 내부에서 처리(따로 사용자 결정 불필요 — 코드에 자명).

## 작업 목록 (총 5개)

### 1. `src/lib/category-meta.ts` 신규

```ts
/**
 * 카테고리 정규화 헬퍼.
 * - canonical 9개: ai / algorithm / db / devops / java / js / react / next / system
 * - 데이터 raw key (categoryIcons 의 keys + 미정의 키) 를 canonical 로 흡수
 * - 누락/미매핑 키는 모두 'system' 으로 default
 */

export type CanonicalCategory =
  | "ai"
  | "algorithm"
  | "db"
  | "devops"
  | "java"
  | "js"
  | "react"
  | "next"
  | "system";

const RAW_TO_CANONICAL: Record<string, CanonicalCategory> = {
  AI: "ai",
  algorithm: "algorithm",
  database: "db",
  redis: "db",
  devops: "devops",
  java: "java",
  javascript: "js",
  html: "js",
  css: "js",
  react: "react",
  next: "next",
};

export function toCanonicalCategory(raw: string): CanonicalCategory {
  return RAW_TO_CANONICAL[raw] ?? "system";
}

/**
 * canonical 에서 oklch hue (degrees) 로 매핑.
 * Round 2 mockup 의 POSTS 데이터 hue 와 일치 — 토큰의 `--color-cat-*` 와도 일치.
 */
const CANONICAL_TO_HUE: Record<CanonicalCategory, number> = {
  ai: 285,
  algorithm: 25,
  db: 55,
  devops: 145,
  java: 180,
  js: 90,
  react: 220,
  next: 0,
  system: 250,
};

export function getCategoryHue(raw: string): number {
  return CANONICAL_TO_HUE[toCanonicalCategory(raw)];
}

/**
 * inline style 의 `--cat-color` CSS variable 값 (mockup 패턴).
 * 컴포넌트에서 `style={{ "--cat-color": getCategoryColor(post.category) } as CSSProperties}` 형태로 사용.
 */
export function getCategoryColor(raw: string): string {
  return `oklch(0.74 0.09 ${getCategoryHue(raw)})`;
}

/**
 * Tailwind 클래스로 `text-[var(--color-cat-*)]` 를 쓰고 싶을 때 토큰 var 이름 반환.
 * (canonical 9개에 한해 토큰 존재)
 */
export function getCategoryTokenVar(raw: string): string {
  return `--color-cat-${toCanonicalCategory(raw)}`;
}
```

설계 메모:
- raw key 가 한글 ("기술공유") 이거나 처음 보는 카테고리여도 `system` 으로 안전하게 흡수
- `getCategoryColor` 는 inline style 용 (mockup 의 `--cat-color` 패턴), `getCategoryTokenVar` 는 Tailwind 클래스 용 — 두 패턴 모두 지원
- `CanonicalCategory` union 으로 타입 안전성 확보

### 2. `src/components/PostCard.tsx` — Editorial row list 기본 + grid variant

기존 (FileText 아이콘 + 가로 flex + ChevronRight) 을 완전히 교체.

```tsx
import Link from "next/link";
import type { CSSProperties } from "react";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "@/infra/db/constants";
import type { PostData } from "@/infra/db/types";
import { getCategoryColor, toCanonicalCategory } from "@/lib/category-meta";
import { Eye } from "lucide-react";

interface PostCardProps {
  post: PostData;
  /** "row" (기본, Editorial) | "grid" (Card grid) */
  variant?: "row" | "grid";
  showCategory?: boolean;
  viewCount?: number;
  /** row variant 에서 좌측에 표시되는 정렬 번호 (없으면 미표시) */
  index?: number;
}

function getCategoryIcon(category: string): string {
  return categoryIcons[category] || DEFAULT_CATEGORY_ICON;
}

function postHref(slug: string): string {
  return `/posts/${slug.split("/").map(encodeURIComponent).join("/")}`;
}

export function PostCard({
  post,
  variant = "row",
  showCategory = true,
  viewCount,
  index,
}: PostCardProps) {
  const catColor = getCategoryColor(post.category);
  const canonical = toCanonicalCategory(post.category);
  const inlineStyle = { "--cat-color": catColor } as CSSProperties;

  if (variant === "grid") {
    return (
      <Link
        href={postHref(post.slug)}
        style={inlineStyle}
        className="group flex flex-col overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] transition-[border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]"
      >
        <div className="flex flex-1 flex-col gap-2 p-5">
          {showCategory && (
            <div
              className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em]"
              style={{ color: "var(--cat-color)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              <span>{canonical}</span>
            </div>
          )}
          <h3 className="text-[17px] font-medium leading-snug tracking-tight text-[var(--color-fg-primary)] line-clamp-2">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--color-fg-secondary)]">
              {post.excerpt}
            </p>
          )}
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-3 font-mono text-[11px] text-[var(--color-fg-muted)]">
            <span>{formatDate(post.createdAt)}</span>
            {viewCount !== undefined && (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {viewCount.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // variant === "row" (기본, Editorial row list)
  const num = typeof index === "number" ? String(index + 1).padStart(3, "0") : null;

  return (
    <Link
      href={postHref(post.slug)}
      style={inlineStyle}
      className="group relative grid grid-cols-[64px_1fr_auto] items-baseline gap-4 border-t border-[var(--color-border-subtle)] py-5 last:border-b md:grid-cols-[80px_1fr_180px_100px] md:gap-6 md:py-6"
    >
      <span className="self-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-faint)]">
        {num ? `— ${num}` : "—"}
      </span>

      <div className="min-w-0">
        <div className="text-[16px] font-medium leading-snug tracking-tight text-[var(--color-fg-primary)] transition-colors duration-150 group-hover:text-[var(--color-brand-400)] md:text-[17px]">
          {post.title}
        </div>
        {post.excerpt && (
          <div className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[var(--color-fg-secondary)] md:text-[14px]">
            {post.excerpt}
          </div>
        )}
        {/* 모바일에선 cat/meta 를 본문 아래로 내림 */}
        <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-[var(--color-fg-muted)] md:hidden">
          {showCategory && (
            <span
              className="inline-flex items-center gap-1.5 uppercase tracking-[0.04em]"
              style={{ color: "var(--cat-color)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              {getCategoryIcon(post.category)} {canonical}
            </span>
          )}
          {viewCount !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {viewCount.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {showCategory && (
        <div
          className="hidden self-center items-center gap-2 font-mono text-[11px] uppercase tracking-[0.04em] md:flex"
          style={{ color: "var(--cat-color)" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          <span>{canonical}</span>
        </div>
      )}

      <div className="hidden self-center text-right font-mono text-[11px] leading-relaxed text-[var(--color-fg-muted)] md:block">
        {formatDate(post.createdAt)}
        {viewCount !== undefined && (
          <>
            <br />
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {viewCount.toLocaleString()}
            </span>
          </>
        )}
      </div>
    </Link>
  );
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
```

설계 메모:
- 기존 prop (`post`, `showCategory`, `viewCount`) **모두 호환**. 신규 `variant`, `index` 는 옵셔널 — 호출 사이트 변경 없이 row 변형이 자동 적용
- mockup 의 `--cat-color` 패턴을 inline style 로 그대로 재현 — Tailwind v4 의 arbitrary `bg-[var(--cat-color)]` 도 가능하지만 dot/text 양쪽에 currentColor 로 같이 쓰기 위해 inline 채택
- 모바일 (sm 미만) 에선 5열 grid 가 깨지므로 cat/meta 를 body 아래로 접어 표시
- `post.excerpt` 와 `post.createdAt` 은 `PostData` 의 기존 필드 — 데이터 스키마 변경 없음

### 3. `src/components/PostCardSkeleton.tsx` — row 변형 매칭 갱신

```tsx
export function PostCardSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-[64px_1fr_auto] items-baseline gap-4 border-t border-[var(--color-border-subtle)] py-5 md:grid-cols-[80px_1fr_180px_100px] md:gap-6 md:py-6">
      <div className="h-3 w-10 rounded bg-[var(--color-bg-overlay)]" />
      <div className="space-y-2 min-w-0">
        <div className="h-4 w-3/4 rounded bg-[var(--color-bg-overlay)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--color-bg-overlay)]" />
      </div>
      <div className="hidden h-3 w-20 rounded bg-[var(--color-bg-overlay)] md:block" />
      <div className="hidden h-3 w-16 rounded bg-[var(--color-bg-overlay)] md:block" />
    </div>
  );
}
```

설계 메모: row variant 의 grid 구조를 그대로 따라 layout shift 최소화.

### 4. `src/components/CategoryCard.tsx` — cat-color 좌측 막대 + mono meta

```tsx
import Link from "next/link";
import type { CSSProperties } from "react";
import type { CategoryData } from "@/infra/db/types";
import { getCategoryColor, toCanonicalCategory } from "@/lib/category-meta";

interface CategoryCardProps {
  category: CategoryData;
}

export function CategoryCard({ category }: CategoryCardProps) {
  const catColor = getCategoryColor(category.slug);
  const canonical = toCanonicalCategory(category.slug);
  const inlineStyle = { "--cat-color": catColor } as CSSProperties;

  return (
    <Link
      href={`/category/${encodeURIComponent(category.slug)}`}
      style={inlineStyle}
      className="group relative block overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4 transition-[border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] md:p-5"
    >
      <span
        className="absolute inset-y-0 left-0 w-[2px] opacity-70 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: "var(--cat-color)" }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-2xl md:text-3xl">{category.icon}</span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight text-[var(--color-fg-primary)] transition-colors duration-150 group-hover:text-[var(--color-brand-400)] md:text-lg">
              {category.name}
            </h3>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--color-fg-muted)]">
              {category.count.toLocaleString()} posts
            </p>
          </div>
        </div>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.06em]"
          style={{ color: "var(--cat-color)" }}
        >
          {canonical}
        </span>
      </div>
    </Link>
  );
}
```

설계 메모:
- 기존 `border-l-4` + Tailwind 색상 클래스 (12개 매핑) → `--cat-color` inline + `<span>` 좌측 막대 1 패턴으로 통합
- `category.count` 의 `n개의 글` (한글 + 천단위 미포맷) → mono `n posts` (천단위 콤마 포함, mockup 의 mono meta 톤)
- 우측 상단에 canonical 라벨 — 같은 카테고리에서도 정규화된 키를 보여주어 매핑 결과 시각화

### 5. `src/components/SectionCTAButton.tsx` 리디자인 + 통합 검증

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface SectionCTAButtonProps {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

export function SectionCTAButton({ href, label, icon }: SectionCTAButtonProps) {
  return (
    <div className="mt-8 flex justify-center">
      <Link
        href={href}
        className="group inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] px-4 py-2 font-mono text-[12px] tracking-tight text-[var(--color-fg-secondary)] transition-[color,border-color] duration-150 ease-out hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]"
      >
        {icon}
        <span>{label}</span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
```

설계 메모:
- 기존 (둥근 사각형 + 파란 배경 + 흰 글씨) → mockup 의 `.cards-filter .pill` 톤 (pill, mono, transparent)
- 시각적 weight 가 줄어들어 카드 리스트의 흐름을 끊지 않음
- focus ring 은 `--color-brand-400` 으로 토큰화 (a11y 보존)

### 통합 검증

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 빌드 산출물에 새 토큰 변수 사용 확인
grep -rE "var\(--color-cat-(ai|system|js|db|react)\)" .next/static/ 2>/dev/null | head -3
```

수동 smoke (선택):
- `pnpm dev` → 홈 (`/`) 의 인기글/최신글 row variant 시각 확인
- 카테고리 페이지 (`/category/<slug>`) 의 PostCard (`showCategory={false}`) 동작 확인
- 카테고리 그리드 (홈 상단) 의 새 CategoryCard 좌측 막대 색 확인
- 다크/라이트 토글 → 둘 다 가독성 OK
- 모바일 (Chrome DevTools 360px) → row variant 가 두 줄로 접히는지

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) category-meta 헬퍼 신규
test -f src/lib/category-meta.ts
grep -n "export type CanonicalCategory" src/lib/category-meta.ts
grep -n "export function toCanonicalCategory" src/lib/category-meta.ts
grep -n "export function getCategoryColor" src/lib/category-meta.ts
grep -n "export function getCategoryHue" src/lib/category-meta.ts

# 2) PostCard variant prop + 토큰 사용
grep -n 'variant\?:\s*"row"\s*|\s*"grid"' src/components/PostCard.tsx
grep -n "getCategoryColor" src/components/PostCard.tsx
grep -nE 'var\(--color-(fg|border|bg|brand|cat)' src/components/PostCard.tsx
! grep -n "bg-amber-400\|bg-purple-400\|bg-orange-400" src/components/PostCard.tsx
! grep -n "FileText\|ChevronRight" src/components/PostCard.tsx

# 3) PostCardSkeleton row 변형 grid 매칭
grep -n "grid-cols-\[64px_1fr_auto\]" src/components/PostCardSkeleton.tsx
grep -nE 'var\(--color-(border|bg)' src/components/PostCardSkeleton.tsx

# 4) CategoryCard 토큰 + cat-color 막대
grep -n "getCategoryColor" src/components/CategoryCard.tsx
grep -n "var(--cat-color)" src/components/CategoryCard.tsx
! grep -n "border-l-amber-400\|border-l-purple-400\|border-l-orange-400" src/components/CategoryCard.tsx
! grep -n "Folder" src/components/CategoryCard.tsx

# 5) SectionCTAButton 새 톤
grep -n "ArrowRight" src/components/SectionCTAButton.tsx
grep -nE 'var\(--color-border|var\(--color-fg' src/components/SectionCTAButton.tsx
! grep -n "bg-blue-600\|dark:bg-blue-500" src/components/SectionCTAButton.tsx

# 6) 호출 사이트 호환 (PostCard prop 변경 없음 — variant 누락 시 row 기본)
grep -n "PostCard" src/app/page.tsx
grep -n "PostCard" src/app/category/\[\.\.\.path\]/page.tsx
grep -n "PostCard" src/components/PostsInfiniteList.tsx

# 7) 통합 빌드/테스트
pnpm test --run src/lib/
pnpm lint
pnpm type-check
pnpm build

# 8) 금지사항 (critic 반복 지적)
! grep -nE "as any" src/lib/category-meta.ts src/components/PostCard.tsx src/components/CategoryCard.tsx
! grep -nE "console\.(log|warn|error)" src/lib/category-meta.ts src/components/PostCard.tsx src/components/CategoryCard.tsx src/components/SectionCTAButton.tsx
```

## 권장 단위 테스트 (선택, executor 판단)

`src/lib/category-meta.test.ts`:
- `toCanonicalCategory("AI")` → `"ai"`
- `toCanonicalCategory("javascript")` → `"js"`
- `toCanonicalCategory("html")` → `"js"`
- `toCanonicalCategory("redis")` → `"db"`
- `toCanonicalCategory("architecture")` → `"system"` (default)
- `toCanonicalCategory("network")` → `"system"`
- `toCanonicalCategory("기술공유")` → `"system"`
- `toCanonicalCategory("totally-unknown-key")` → `"system"`
- `getCategoryHue("react")` → `220`
- `getCategoryHue("database")` → `55` (db hue)
- `getCategoryColor("AI")` 가 `"oklch(0.74 0.09 285)"` 정확히 반환

(executor 가 시간 여유 있으면 작성 — 핵심 default 동작 회귀 방지)

## PHASE_BLOCKED 조건

- `globals.css` 에 `--color-cat-system` 토큰이 없음 → **PHASE_BLOCKED: plan009 미머지**
- `geist/font/sans` import 가 layout.tsx 에 없음 → **PHASE_BLOCKED: plan009 미머지**
- PostData/CategoryData 타입에 `excerpt` 또는 `createdAt` 또는 `count` 가 없음 → **PHASE_BLOCKED: 데이터 스키마 확인 필요** (executor 가 import 해서 실제 필드 확인 — 누락이면 사용자 에스컬레이션)

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋 분리:
- `feat(lib): add category-meta helper for canonical category normalization`
- `feat(components): redesign PostCard with row/grid variants from design tokens`
- `feat(components): redesign CategoryCard with cat-color accent bar`
- `feat(components): restyle SectionCTAButton as mono pill link`
