# Phase 03 — ArticleHero + ArticleFooter + HomeHero stat UI

**Model**: sonnet
**Goal**: 컴포넌트 시그니처 확장 + 시각 적용. phase-02 의 page.tsx 가 준비한 props 를 컴포넌트가 실제로 사용.

## 작업 항목

### 1. ArticleHero 에 Series 메타 추가

`src/components/ArticleHero.tsx` props 확장:

```ts
interface ArticleHeroProps {
  // ... 기존
  series?: { name: string; order: number; total: number } | null;
}
```

Hero 의 meta row (날짜/읽기시간/조회수 옆) 또는 별도 라인에 표시. `next/link` 의 `Link` import 가 이미 있는지 확인:

```tsx
{series && (
  <Link
    href={`/series/${encodeURIComponent(series.name)}`}
    className="font-mono text-[12px] text-[var(--color-fg-muted)] hover:text-[var(--color-brand-400)] transition-colors"
  >
    SERIES · {series.name} · {series.order}/{series.total}
  </Link>
)}
```

executor 는 ArticleHero 의 기존 meta row JSX 위치를 grep 으로 찾아 자연스럽게 삽입.

### 2. ArticleFooter 변경 — series chip + prev/next 카드

`src/components/ArticleFooter.tsx` props 확장:

```ts
interface ArticleFooterProps {
  tags?: string[];
  series?: string | null;
  prevInSeries?: { title: string; slug: string } | null;
  nextInSeries?: { title: string; slug: string } | null;
}
```

기존 tags chip row 옆에 series chip 추가 (있을 때만):

```tsx
{series && (
  <Link
    href={`/series/${encodeURIComponent(series)}`}
    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-brand-400)] text-[13px] font-mono transition-colors"
  >
    📚 {series}
  </Link>
)}
```

ArticleFooter 끝에 신규 prev/next 카드 섹션. **prev/next 라우팅은 PostCard 의 `postHref` 패턴과 동일하게 `slug` 기준 + segment encoding**:

```tsx
{(prevInSeries || nextInSeries) && (
  <nav aria-label="In this series" className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
    {prevInSeries ? (
      <Link
        href={`/posts/${prevInSeries.slug.split("/").map(encodeURIComponent).join("/")}`}
        className="block bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[12px] p-5 hover:border-[var(--color-brand-400)] transition-colors"
      >
        <span className="block font-mono text-[11px] text-[var(--color-fg-muted)] tracking-wider mb-1">← PREVIOUS</span>
        <span className="block text-[14px] font-medium text-[var(--color-fg-primary)] line-clamp-2">{prevInSeries.title}</span>
      </Link>
    ) : <div />}
    {nextInSeries ? (
      <Link
        href={`/posts/${nextInSeries.slug.split("/").map(encodeURIComponent).join("/")}`}
        className="block bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[12px] p-5 hover:border-[var(--color-brand-400)] transition-colors text-right"
      >
        <span className="block font-mono text-[11px] text-[var(--color-fg-muted)] tracking-wider mb-1">NEXT →</span>
        <span className="block text-[14px] font-medium text-[var(--color-fg-primary)] line-clamp-2">{nextInSeries.title}</span>
      </Link>
    ) : <div />}
  </nav>
)}
```

slug segment encoding 은 `PostCard.tsx` 의 `postHref` 함수 패턴과 동일. 헬퍼 추출 가능 시 `src/lib/post-href.ts` 등 신규 파일에 분리해서 PostCard 와 ArticleFooter 가 공유 (선택 — 인라인 중복도 무방).

### 3. `src/app/posts/[...slug]/page.tsx` 호출부 갱신

phase-02 에서 준비한 `seriesMeta` / `prevInSeries` / `nextInSeries` 를 ArticleHero / ArticleFooter 에 전달:

```tsx
<ArticleHero
  // ... 기존 props
  series={seriesMeta}
/>
// ...
<ArticleFooter
  tags={frontMatter.tags}
  series={postData.series}
  prevInSeries={prevInSeries}
  nextInSeries={nextInSeries}
/>
```

### 4. HomeHero seriesCount 실값 연결

`src/app/page.tsx` 의 hardcoded `const seriesCount: number | null = null;` 라인 제거 + `Promise.all` 에 `post.countSeries()` 추가:

```ts
const [categories, recentPosts, popularPosts, postCountTotal, seriesCount] = await Promise.all([
  // ... 기존
  post.countSeries(),
]);
```

### 5. 자동 verification

```bash
# cwd: /Users/nhn/personal/fos-blog/.claude/worktrees/plan033-series-system
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

grep -n "series" src/components/ArticleHero.tsx
grep -n "prevInSeries\|nextInSeries" src/components/ArticleFooter.tsx
! grep -nE "seriesCount: number \| null = null" src/app/page.tsx
grep -n "post.countSeries" src/app/page.tsx
```

수동 smoke (dev server):
- 시리즈 메타 가진 글 1개 frontmatter 추가 (`series: Test`, `seriesOrder: 1`) + sync → /series/Test 페이지 표시
- 같은 series 의 글 2개 만들고 prev/next 카드 동작 확인
- HomeHero 의 series stat 이 실값으로 표시 (예: `1`)

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/components/ArticleHero.tsx` | 수정 (series prop) |
| `src/components/ArticleFooter.tsx` | 수정 (series chip + prev/next 카드) |
| `src/app/posts/[...slug]/page.tsx` | 수정 (호출부에 series props 전달) |
| `src/app/page.tsx` | 수정 (seriesCount 실값) |

## Risks

| 리스크 | 완화 |
|---|---|
| Hero 메타 라인이 너무 길어 모바일 줄바꿈 깨짐 | 모바일 smoke 확인. truncate 또는 줄바꿈 허용 |
| prev/next 라우팅 slug 인코딩 누락 | postHref 와 동일 패턴 (`slug.split("/").map(encodeURIComponent).join("/")`) 명시 |
| series chip 의 이모지가 일부 OS 에서 다르게 렌더 | 이모지 대신 `lucide-react` 의 `BookOpen` 아이콘 대체 가능 (선택) |
