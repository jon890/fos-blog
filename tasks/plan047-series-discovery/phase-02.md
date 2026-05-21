# Phase 02 — SeriesCard 컴포넌트 + /series 인덱스 페이지

**Model**: sonnet
**Goal**: `SeriesCard` 신규 컴포넌트 + `/series` 인덱스 페이지 신설.

## Context (자기완결)

- phase-01 에서 `PostRepository.getAllSeries()` 와 `SeriesInfo` 타입이 추가된 상태
- 시리즈 카드는 ADR-028 결정에 따라 `PostCard` variant 가 아닌 별도 컴포넌트
- 디자인 시각 언어는 `PostCard` grid variant 와 의도적 일치 — 같은 border / hover / 카테고리 chip / typography 토큰
- 페이지 패턴은 `/tag/[name]` (`src/app/tag/[name]/page.tsx`) 과 유사하나 시리즈 인덱스는 0건 시 `notFound()` 가 아니라 빈 상태 메시지

**기존 참조 컴포넌트**:
- `src/components/PostCard.tsx` (grid variant) — border / hover / 카테고리 chip 토큰
- `src/components/PostsListSubHero.tsx` — eyebrow + title + meta 헤더
- `src/components/SectionCTAButton.tsx` — CTA 버튼

## 작업 항목

### 1. `SeriesCard` 컴포넌트 신설

`src/components/SeriesCard.tsx`:

```tsx
import Link from "next/link";
import type { CSSProperties } from "react";
import type { SeriesInfo } from "@/infra/db/types";
import { getCategoryColor, toCanonicalCategory } from "@/lib/category-meta";

interface SeriesCardProps {
  series: SeriesInfo;
}

function seriesHref(name: string): string {
  return `/series/${encodeURIComponent(name)}`;
}

function formatDate(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export function SeriesCard({ series }: SeriesCardProps) {
  const catColor = getCategoryColor(series.firstPost.category);
  const canonical = toCanonicalCategory(series.firstPost.category);
  const inlineStyle = { "--cat-color": catColor } as CSSProperties;

  return (
    <Link
      href={seriesHref(series.name)}
      style={inlineStyle}
      className="group flex flex-col overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] transition-[border-color,transform] duration-[var(--duration-default)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div
          className="flex items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.06em]"
        >
          <span className="flex items-center gap-2" style={{ color: "var(--cat-color)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            <span>{canonical}</span>
          </span>
          <span className="text-[var(--color-fg-muted)]">{series.postCount} posts</span>
        </div>
        <h3 className="text-[17px] font-medium leading-snug tracking-tight text-[var(--color-fg-primary)] line-clamp-2">
          {series.name}
        </h3>
        {series.firstPost.description && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--color-fg-secondary)]">
            {series.firstPost.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-3 font-mono text-[11px] text-[var(--color-fg-muted)]">
          <span>{formatDate(series.latestUpdatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
```

명명 / 토큰 컨벤션은 PostCard grid variant 와 일치 — `bg-[var(--color-bg-elevated)]`, `border-[var(--color-border-subtle)]`, `hover:-translate-y-0.5` 등.

### 2. `/series` 인덱스 페이지 신설

`src/app/series/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getRepositories } from "@/infra/db/repositories";
import { PostsListSubHero } from "@/components/PostsListSubHero";
import { SeriesCard } from "@/components/SeriesCard";
import { env } from "@/env";

const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const revalidate = 300;

export const metadata: Metadata = {
  title: "시리즈",
  description: "FOS Study 블로그의 모든 시리즈 모음",
  alternates: { canonical: `${siteUrl}/series` },
  openGraph: {
    title: "시리즈 | FOS Study",
    description: "FOS Study 블로그의 모든 시리즈 모음",
    url: `${siteUrl}/series`,
    type: "website",
  },
};

export default async function SeriesIndexPage() {
  const { post } = getRepositories();
  const seriesList = await post.getAllSeries();

  return (
    <div className="container mx-auto max-w-[1180px] px-4">
      <PostsListSubHero
        eyebrow="SERIES"
        title="시리즈"
        meta={`${seriesList.length} SERIES`}
      />
      {seriesList.length === 0 ? (
        <div className="py-16 text-center text-[var(--color-fg-muted)]">
          아직 등록된 시리즈가 없습니다.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-6 pb-16 md:grid-cols-2">
          {seriesList.map((s) => (
            <li key={s.name}>
              <SeriesCard series={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

기존 `src/app/series/[name]/page.tsx` 와 같은 디렉터리에 배치. App Router 라 `page.tsx` 가 `/series` 라우트, `[name]/page.tsx` 가 `/series/<name>` 라우트.

### 3. 자동 verification

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm lint
pnpm type-check

# 라우트 파일 존재
ls src/app/series/page.tsx
ls src/components/SeriesCard.tsx

# import 정합성
grep -n "SeriesCard\|getAllSeries\|SeriesInfo" src/app/series/page.tsx src/components/SeriesCard.tsx

# dev server 부팅 후 /series 응답 확인 (수동)
# (phase-04 통합 검증에서 cmux browser 로 시각 확인 예정)
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/components/SeriesCard.tsx` | 신설 |
| `src/app/series/page.tsx` | 신설 |

## Out of Scope

- Header navigation / 메인 페이지 시리즈 섹션 → phase 03
- 통합 검증 → phase 04
- SeriesCard 의 viewCount / latestPost preview 등 추가 메타 — 본 phase 는 ADR-028 의 도메인 필드만

## Risks

| 리스크 | 완화 |
|---|---|
| `getCategoryColor` 가 시리즈명/카테고리 매핑에서 예외 발생 | 첫 글의 category 를 사용하므로 기존 PostCard 와 동일. 회귀 위험 없음 |
| `/series` 와 `/series/[name]` 충돌 | Next.js App Router 는 정적 path 우선 매칭. `/series` 가 정확히 `page.tsx` 로, 그 외는 `[name]/page.tsx` 로 — 충돌 없음 |
| 페이지 메타 OpenGraph image 누락 | 본 phase 는 기본 metadata 만. og:image 동적 생성은 별 plan (RSS / SEO 후속) |
