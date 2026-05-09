# Phase 02 — Repository + /series/[name] page + posts/[...slug] 통합

**Model**: sonnet
**Goal**: 시리즈 조회 메서드 + /series/[name] 라우트 + posts page 의 series 데이터 fetch + props 전달.

UI 컴포넌트 변경 (ArticleHero/Footer/HomeHero) 은 phase-03 에서 일괄 처리.

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

async getSeriesNeighbors(post: Post): Promise<{ prev: Post | null; next: Post | null; total: number }> {
  if (!post.series || post.seriesOrder == null) return { prev: null, next: null, total: 0 };
  const all = await this.getPostsBySeries(post.series);
  const idx = all.findIndex((p) => p.id === post.id);
  if (idx === -1) return { prev: null, next: null, total: all.length };
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
    total: all.length,
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

`/tag/[name]/page.tsx` 를 baseline 으로 복제 + series 조회 + sub-hero 라벨 + generateMetadata 명시:

```tsx
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepositories } from "@/infra/db/repositories";
import { PostsListSubHero } from "@/components/PostsListSubHero";
import { PostCard } from "@/components/PostCard";
import { env } from "@/env";

interface Props {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const series = decodeURIComponent(name);
  const url = `${env.NEXT_PUBLIC_SITE_URL}/series/${encodeURIComponent(series)}`;
  return {
    title: `시리즈: ${series}`,
    description: `${series} 시리즈 글 모음`,
    alternates: { canonical: url },
    openGraph: {
      title: `시리즈: ${series}`,
      description: `${series} 시리즈 글 모음`,
      url,
      type: "website",
    },
  };
}

export default async function SeriesPage({ params }: Props) {
  const { name } = await params;
  const series = decodeURIComponent(name);
  const { post } = getRepositories();
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
}
```

`<ol>` + 번호 표시 — 시리즈는 순서가 의미 있음 (tag 와 다른 점). 정확한 import 경로/타입은 `tag/[name]/page.tsx` 에서 직접 확인 후 동일 패턴 유지.

### 3. `src/app/posts/[...slug]/page.tsx` 통합

기존 page.tsx 에서 post 로드 후 series 데이터 fetch:

```ts
const seriesNeighbors = postData.series && postData.seriesOrder != null
  ? await post.getSeriesNeighbors(postData)
  : { prev: null, next: null, total: 0 };

// seriesOrder 0 이 valid 한 경우를 위해 != null (== 0 도 통과). === 사용 금지.
const seriesMeta = postData.series && postData.seriesOrder != null && seriesNeighbors.total > 0
  ? { name: postData.series, order: postData.seriesOrder, total: seriesNeighbors.total }
  : null;

const prevInSeries = seriesNeighbors.prev
  ? { title: seriesNeighbors.prev.title, slug: seriesNeighbors.prev.slug }
  : null;
const nextInSeries = seriesNeighbors.next
  ? { title: seriesNeighbors.next.title, slug: seriesNeighbors.next.slug }
  : null;
```

ArticleHero / ArticleFooter 호출부에 `series={seriesMeta}` / `series={postData.series}` / `prevInSeries={prevInSeries}` / `nextInSeries={nextInSeries}` props 추가. **단 ArticleHero / ArticleFooter 자체의 props 시그니처 확장은 phase-03 에서 처리** — phase-02 완료 시점에서는 page.tsx 가 아직 사용하지 않는 형태로 props 만 준비 (또는 page.tsx 의 해당 라인을 phase-03 에 함께 적용). executor 는 page.tsx 의 series 데이터 fetch 까지만 phase-02 에서 마치고, 컴포넌트 props 전달은 phase-03 의 컴포넌트 시그니처 확장과 같은 commit 단위로 처리.

### 4. 자동 verification

```bash
# cwd: /Users/nhn/personal/fos-blog/.claude/worktrees/plan033-series-system
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

test -d src/app/series/\[name\]
test -f src/app/series/\[name\]/page.tsx
grep -n "getPostsBySeries\|getSeriesNeighbors\|countSeries" src/infra/db/repositories/PostRepository.ts
grep -n "generateMetadata" src/app/series/\[name\]/page.tsx
grep -n "getSeriesNeighbors" src/app/posts/\[...slug\]/page.tsx
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/infra/db/repositories/PostRepository.ts` | 수정 (3 메서드 추가) |
| `src/app/series/[name]/page.tsx` | 신규 |
| `src/app/posts/[...slug]/page.tsx` | 수정 (series 데이터 fetch, props 전달은 phase-03 와 함께) |

## Out of Scope

- ArticleHero / ArticleFooter / HomeHero 변경 → phase-03
- /series 인덱스 페이지 (결정상 OOS)
- sitemap.xml 추가 (tag 도 미포함, 일관성 OOS)

## Risks

| 리스크 | 완화 |
|---|---|
| getSeriesNeighbors 가 매번 같은 series 의 모든 글 조회 (N+1) | 218 글 규모, 1 series 당 평균 3~5 글 — N=5 무시. 향후 50+ 글 시 별도 인덱스/캐시 |
| series 이름 한글 + 공백 시 URL encoding | encodeURIComponent + decodeURIComponent 명시 사용 (tag 패턴 동일) |
| seriesOrder == 0 valid 케이스 (1-based 가 아닌 0-based) | `!= null` 가드 (`==` 0 통과). `===` 사용 금지 명문화 |
| Post.path vs Post.slug 혼동 | route 용은 항상 `slug` (PostCard.tsx 의 postHref 패턴). prev/next 카드도 동일 |
