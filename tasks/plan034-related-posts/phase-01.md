# Phase 01 — getRelatedPosts + RelatedPosts 컴포넌트 + 글 상세 통합

**Model**: sonnet
**Goal**: 글 상세 페이지에 관련 글 4개 노출. ArticleFooter 아래, Comments 위에 독립 섹션 "이런 글도".

## Context (자기완결)

`src/app/posts/[...slug]/page.tsx` 는 ArticleHero → MarkdownRenderer → ArticleFooter → Comments 순서. 이번 phase 는 ArticleFooter 와 Comments 사이에 `<RelatedPosts>` 섹션 신규 삽입.

plan026 (tags) 에서 `posts.tags JSON[]` 컬럼 + JSON_CONTAINS 쿼리 패턴 도입. 이번 phase 는 그 패턴 확장.

**결정 (사용자 2026-05-08)**:
- 위치: ArticleFooter 아래 + Comments 위 (독립 섹션)
- 개수: **4개 고정**
- 매칭 우선순위: 같은 카테고리 + tag 교집합 size desc, createdAt desc
- tag 교집합 0 이면: 같은 카테고리 + createdAt desc 로 채움
- 임베딩 / 의미 유사도: OOS

**시그니처 결정 (critic v1 REVISE 반영, 2026-05-19)**:

`PostData` 타입에 `id` / `tags` 가 없으므로 (`src/infra/db/types.ts`), `getRelatedPosts(currentPost: Post, ...)` 시그니처는 컴파일 실패.
대안: `getRelatedPosts(slug: string, limit = 4): Promise<PostData[]>` — 함수 내부에서 1차 select 로 id/category/tags 조회, 2차로 candidates 조회.
PostData 타입 오염 회피.
1차 SELECT 추가 비용은 218 글 규모에서 무시 (인덱스 path_idx 적중).

## 작업 항목

### 1. `PostRepository.getRelatedPosts(slug, limit)` + helper 신규

`src/infra/db/repositories/PostRepository.ts`:

```ts
async getRelatedPosts(slug: string, limit = 4): Promise<PostData[]> {
  // 1차: 현재 글 id/category/tags 조회
  const current = await this.db
    .select({ id: posts.id, category: posts.category, tags: posts.tags })
    .from(posts)
    .where(and(eq(posts.path, slug), eq(posts.isActive, true)))
    .limit(1);

  const cur = current[0];
  if (!cur) return [];

  const currentTags = cur.tags ?? [];

  // 2차: 같은 카테고리 + 자기 자신 제외 + isActive 만 후보. createdAt desc fetch
  const candidates = await this.db
    .select({
      title: posts.title,
      path: posts.path,
      slug: posts.slug,
      category: posts.category,
      subcategory: posts.subcategory,
      folders: posts.folders,
      description: posts.description,
      series: posts.series,
      seriesOrder: posts.seriesOrder,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      tags: posts.tags, // 점수 계산용 임시 — 매핑 시 제거
    })
    .from(posts)
    .where(
      and(
        eq(posts.isActive, true),
        eq(posts.category, cur.category),
        ne(posts.id, cur.id),
      ),
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit * 4);

  // application-side 점수: tag intersection size desc, 동점 시 createdAt desc 유지 (stable sort)
  const scored = candidates.map((p) => ({
    post: p,
    score: tagIntersectionSize(p.tags ?? [], currentTags),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ post: p }) => ({
    title: p.title,
    path: p.path,
    slug: p.slug,
    category: p.category,
    subcategory: p.subcategory,
    folders: p.folders || [],
    description: p.description,
    series: p.series,
    seriesOrder: p.seriesOrder,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}
```

파일 상단 helper (private 메서드 또는 파일 스코프 함수):
```ts
function tagIntersectionSize(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(a.map((t) => t.toLowerCase()));
  let count = 0;
  for (const t of b) if (set.has(t.toLowerCase())) count++;
  return count;
}
```

기존 글 ~218 + 카테고리 9개 → 카테고리당 평균 24글.
`limit * 4 = 16` candidate fetch 충분.
JSON_CONTAINS 점수 계산은 application-side — 218 글 규모 무시 가능.
1000+ 도달 시 SQL JSON_OVERLAPS / 인덱스 검토.

### 2. `src/components/RelatedPosts.tsx` 신규

```tsx
import { PostCard } from "./PostCard";
import type { PostData } from "@/infra/db/types";

interface Props {
  posts: PostData[];
}

export function RelatedPosts({ posts }: Props) {
  if (posts.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1180px] px-4 py-12 md:py-16 border-t border-[var(--color-border-subtle)]">
      <div className="flex items-center gap-3 mb-8">
        <span className="h-px w-6 bg-[var(--color-brand-400)]" />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-fg-muted)]">
          이런 글도
        </h2>
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {posts.map((p) => (
          <li key={p.path}>
            <PostCard post={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`<PostCard>` props 시그니처 (PostCard.tsx:8-) 와 일치 확인 후 사용.
eyebrow 패턴은 plan016 의 `<PostsListSubHero>` 와 동일.

### 3. `src/app/posts/[...slug]/page.tsx` 통합

ArticleFooter 와 Comments 사이에 `<RelatedPosts>` 삽입.
fetch 는 `getPost` 이후 (slug 가 필요).
**기존 seriesNeighbors 호출은 그대로 두고 (시그니처/폴백 회귀 위험 회피)**, viewCount 와 relatedPosts 만 Promise.all 로 병렬:

```ts
const data = await postRepo.getPost(slug);
if (!data) notFound();
const { post: postData, content } = data;

// (기존) seriesNeighbors 호출 위치는 변경하지 않는다.
// viewCount + relatedPosts 만 병렬:
const [viewCount, relatedPosts] = await Promise.all([
  visit.getVisitCount(postData.path),
  postRepo.getRelatedPosts(postData.path, 4),
]);
```

seriesNeighbors 는 본 phase scope 외. 시그니처 (`getSeriesNeighbors(post: PostData)`) + 폴백 객체 모양 (`{ prev: null, next: null, total: 0 }`) 변경은 회귀 위험. 본 plan 의 가치 (관련 글 노출) 는 relatedPosts 병렬화로 충분.
JSX 트리:

```tsx
<ArticleFooter ... />
<RelatedPosts posts={relatedPosts} />
<Comments postSlug={postData.path} />
```

### 4. 자동 verification

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 기계 검증
grep -n "getRelatedPosts" src/infra/db/repositories/PostRepository.ts
test -f src/components/RelatedPosts.tsx
grep -n "RelatedPosts" src/app/posts/\[...slug\]/page.tsx
grep -n "Promise.all" src/app/posts/\[...slug\]/page.tsx   # 병렬 fetch 보장
grep -n "PostCard" src/components/RelatedPosts.tsx          # PostCard 통합 확인
```

수동 smoke (PR 머지 후 확인):
- 글 상세 페이지 진입 → ArticleFooter 다음 "이런 글도" 섹션 + 카드 표시
- 같은 tag 가진 다른 글이 있으면 그게 상위로
- tag 교집합 없을 때 같은 카테고리 최근 글 fallback

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/infra/db/repositories/PostRepository.ts` | 수정 (getRelatedPosts + tagIntersectionSize helper) |
| `src/components/RelatedPosts.tsx` | 신규 |
| `src/app/posts/[...slug]/page.tsx` | 수정 (Promise.all 안에 getRelatedPosts + RelatedPosts mount) |

## Out of Scope

- 임베딩 기반 의미 유사도 (별도 issue)
- 관련 글 클릭 추적 (analytics)
- 카테고리 외 다른 시리즈 우선 매칭 (시리즈 prev/next 는 plan033 에서 별도 처리)
- 캐싱 — 글 상세 페이지의 revalidate 정책 그대로
- `PostData` 타입 변경 — 본 phase 는 함수 내부 1차 select 로 회피

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| 같은 카테고리 글이 4개 미만 → 슬롯 못 채움 | 1~3개 그대로 표시 (사용자 결정 OK). 0 일 때만 `<RelatedPosts>` 가 `null` 반환 |
| tagIntersectionSize application-side → 1000+ 글에서 느려짐 | 218 글 + limit*4=16 candidate — 부하 무시. 1000+ 도달 시 SQL JSON_OVERLAPS / 인덱스 도입 |
| 1차 SELECT 추가 라운드트립 | path_idx 적중 단발 SELECT — 무시 가능. PostData 타입 오염 회피가 더 큰 이득 |
| tag 빈 배열 다수 → 점수 0 동점 | 동점은 createdAt desc 자연 정렬 (stable sort 보장) |
| seriesNeighbors 호출 위치 변경 → 회귀 | grep "Promise.all" verification 으로 위치 확인. test 로 페이지 렌더 회귀 검출 |
