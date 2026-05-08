# Phase 02 — Repository + 페이지 + Hero/Footer UI + HomeHero stat

**Model**: sonnet
**Goal**: 시리즈 조회 메서드 + /series/[name] 라우트 + ArticleHero 메타 + ArticleFooter prev/next 카드 + tags 옆 series chip + HomeHero seriesCount 실값.

## 작업 항목

### 1. `PostRepository` 메서드 3개 추가

`src/infra/db/repositories/PostRepository.ts`:

```ts
async getPostsBySeries(series: string): Promise<Post[]> {
  return this.db
    .select()
    .from(posts)
    .where(and(eq(posts.isActive, true), eq(posts.series, series)))
    .orderBy(asc(posts.seriesOrder));
}

async getSeriesNeighbors(post: Post): Promise<{ prev: Post | null; next: Post | null }> {
  if (!post.series || post.seriesOrder == null) return { prev: null, next: null };
  const all = await this.getPostsBySeries(post.series);
  const idx = all.findIndex((p) => p.id === post.id);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
}

async countSeries(): Promise<number> {
  const [{ count }] = await this.db
    .select({ count: sql<string>`count(distinct ${posts.series})` })
    .from(posts)
    .where(and(eq(posts.isActive, true), isNotNull(posts.series)));
  return Number(count);
}
```

(MySQL count 은 `sql<string>` + `Number()` — common-pitfalls 패턴)

### 2. `src/app/series/[name]/page.tsx` 신규

`/tag/[name]/page.tsx` 를 baseline 으로 복제 + series 조회 + sub-hero 라벨만 변경:

```tsx
const series = decodeURIComponent(name);
const posts = await post.getPostsBySeries(series);
if (posts.length === 0) notFound();

return (
  <div className="container mx-auto max-w-[1180px] px-4">
    <PostsListSubHero
      eyebrow="SERIES"
      title={series}
      meta={`${posts.length} POSTS`}
    />
    <ol className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-16">
      {posts.map((p, i) => (
        <li key={p.path} className="relative">
          <span className="absolute -left-2 -top-2 z-10 font-mono text-[11px] text-[var(--color-fg-muted)]">
            {String(i + 1).padStart(2, "0")}
          </span>
          <PostCard post={p} />
        </li>
      ))}
    </ol>
  </div>
);
```

`<ol>` + 번호 표시 — 시리즈는 순서가 의미 있음 (tag 와 다른 점). generateMetadata 도 tag 페이지 패턴 그대로.

### 3. ArticleHero 에 Series 메타 추가

`src/components/ArticleHero.tsx` props 확장:

```ts
interface ArticleHeroProps {
  // ... 기존
  series?: { name: string; order: number; total: number } | null;
}
```

Hero 의 meta row (날짜/읽기시간/조회수 옆) 또는 별도 라인에 표시:

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

### 4. ArticleFooter 변경 — series chip + prev/next 카드

`src/components/ArticleFooter.tsx` props 확장:

```ts
interface ArticleFooterProps {
  tags?: string[];
  series?: string | null;
  prevInSeries?: { title: string; path: string } | null;
  nextInSeries?: { title: string; path: string } | null;
}
```

기존 tags chip row 옆에 series chip 추가 (있을 때만):

```tsx
{series && (
  <Link href={`/series/${encodeURIComponent(series)}`} className="...">
    📚 {series}
  </Link>
)}
```

그리고 ArticleFooter 끝에 신규 prev/next 카드 섹션:

```tsx
{(prevInSeries || nextInSeries) && (
  <nav aria-label="In this series" className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
    {prevInSeries ? (
      <Link href={`/posts/${...}`} className="card prev">
        <span className="eyebrow">← PREVIOUS</span>
        <span className="title">{prevInSeries.title}</span>
      </Link>
    ) : <div />}
    {nextInSeries ? (
      <Link href={`/posts/${...}`} className="card next text-right">
        <span className="eyebrow">NEXT →</span>
        <span className="title">{nextInSeries.title}</span>
      </Link>
    ) : <div />}
  </nav>
)}
```

카드 배경 `bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[12px] p-5 hover:border-[var(--color-brand-400)] transition-colors`.

### 5. `src/app/posts/[...slug]/page.tsx` 통합

기존 page.tsx 에서 post 로드 후:

```ts
const seriesNeighbors = postData.series
  ? await post.getSeriesNeighbors(postData)
  : { prev: null, next: null };

const seriesMeta = postData.series && postData.seriesOrder != null
  ? { name: postData.series, order: postData.seriesOrder, total: ... }  // total 은 getPostsBySeries(series).length 또는 getSeriesNeighbors 보강
  : null;
```

`getSeriesNeighbors` 가 이미 `getPostsBySeries` 를 호출하니 total 도 같이 반환하도록 시그니처 확장:

```ts
async getSeriesNeighbors(post): Promise<{ prev: Post | null; next: Post | null; total: number }> {
  // ...
  return { prev, next, total: all.length };
}
```

`<ArticleHero series={seriesMeta} ... />` + `<ArticleFooter prevInSeries={...} nextInSeries={...} series={postData.series} ... />` 전달.

### 6. HomeHero seriesCount 실값 연결

`src/app/page.tsx` 의 `seriesCount` 를 hardcoded `null` 에서 실값으로:

```ts
const [categories, recentPosts, popularPosts, postCountTotal, seriesCount] = await Promise.all([
  // ... 기존
  post.countSeries(),
]);
```

기존 `const seriesCount: number | null = null;` 라인 제거.

### 7. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

test -d src/app/series/\[name\]
test -f src/app/series/\[name\]/page.tsx
grep -n "getPostsBySeries\|getSeriesNeighbors\|countSeries" src/infra/db/repositories/PostRepository.ts
grep -n "series" src/components/ArticleHero.tsx
grep -n "prevInSeries\|nextInSeries" src/components/ArticleFooter.tsx
! grep -nE "seriesCount: number \| null = null" src/app/page.tsx
```

수동 smoke:
- 시리즈 메타 가진 글 1개 frontmatter 추가 (\"series: Test\", \"seriesOrder: 1\") + sync → /series/Test 페이지 표시
- 같은 series 의 글 2개 만들고 prev/next 카드 동작 확인
- HomeHero 의 series stat 이 실값으로 표시 (예: \"1\")

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/infra/db/repositories/PostRepository.ts` | 수정 (3 메서드 추가) |
| `src/app/series/[name]/page.tsx` | 신규 |
| `src/components/ArticleHero.tsx` | 수정 (series prop) |
| `src/components/ArticleFooter.tsx` | 수정 (series chip + prev/next 카드) |
| `src/app/posts/[...slug]/page.tsx` | 수정 (series 데이터 fetch + 컴포넌트 props 전달) |
| `src/app/page.tsx` | 수정 (seriesCount 실값) |

## Risks

| 리스크 | 완화 |
|---|---|
| getSeriesNeighbors 가 매번 같은 series 의 모든 글 조회 (N+1) | 218 글 규모에서는 1 series 당 평균 3~5 글 — N=5 이라 무시 가능. 향후 시리즈가 50+ 글 되면 별도 인덱스/캐시 |
| series 이름이 한글 + 공백 시 URL encoding 문제 | encodeURIComponent + decodeURIComponent 명시 사용 (tag 패턴과 동일) |
| Hero 메타 라인이 너무 길어 모바일에서 줄바꿈 깨짐 | 모바일 smoke 시 확인. truncate 또는 줄바꿈 허용 (시각 영향 작음) |
