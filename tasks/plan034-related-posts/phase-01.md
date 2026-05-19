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

## 작업 항목

### 1. `PostRepository.getRelatedPosts(currentPost, limit)` 신규

`src/infra/db/repositories/PostRepository.ts`:

```ts
async getRelatedPosts(currentPost: Post, limit = 4): Promise<Post[]> {
  const tags = currentPost.tags ?? [];

  // 같은 카테고리 + 자기 자신 제외 + isActive 만 후보. createdAt desc 로 fetch
  const candidates = await this.db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.isActive, true),
        eq(posts.category, currentPost.category),
        ne(posts.id, currentPost.id),
      ),
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit * 4);  // 약간 여유 — 태그 점수 정렬 후 상위 limit 만

  // application-side 점수: tag intersection size desc, 동점 시 createdAt desc 유지
  const scored = candidates.map((p) => ({
    post: p,
    score: tagIntersectionSize(p.tags ?? [], tags),
  }));

  scored.sort((a, b) => b.score - a.score);  // stable sort — 동점은 위 candidates 의 createdAt desc 순서 유지

  return scored.slice(0, limit).map((s) => s.post);
}
```

helper:
```ts
function tagIntersectionSize(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(a.map((t) => t.toLowerCase()));
  let count = 0;
  for (const t of b) if (set.has(t.toLowerCase())) count++;
  return count;
}
```

기존 글 수 ~218 + 카테고리 9개 → 카테고리당 평균 24글. `limit * 4 = 16` 으로 fetch 충분. JSON_CONTAINS 를 SQL 단에서 점수 계산하지 않고 application-side 정렬 — 218 글 규모에서 무시 가능. 향후 글이 1000+ 되면 별도 인덱스 / SQL JSON_OVERLAPS 도입 검토.

### 2. `src/components/RelatedPosts.tsx` 신규

```tsx
import { PostCard } from "./PostCard";
import type { Post } from "@/infra/db/schema/posts";

interface Props {
  posts: Post[];
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

`<PostCard>` 의 기존 props 시그니처 그대로 재사용. eyebrow 패턴은 plan016 의 `<PostsListSubHero>` 와 동일.

### 3. `src/app/posts/[...slug]/page.tsx` 통합

ArticleFooter 와 Comments 사이에 삽입:

```tsx
const { post } = getRepositories();
// ... 기존 fetch
const relatedPosts = await post.getRelatedPosts(postData, 4);

// JSX 트리:
<ArticleFooter ... />
<RelatedPosts posts={relatedPosts} />
<Comments postSlug={postData.path} />
```

`getRelatedPosts` 호출은 다른 fetch 와 함께 `Promise.all` 로 병렬 — 페이지 LCP 영향 최소화:

```ts
const [data, viewCount, relatedPosts] = await Promise.all([
  post.getPost(decoded),
  visit.getVisitCount(postData.path),
  post.getRelatedPosts(postData, 4),  // postData 가 위 data 의 결과라 의존 — Promise.all 안에서는 불가
]);
```

→ `getRelatedPosts` 는 `data` 가 필요하므로 `Promise.all` 안에 못 넣음. 그대로 sequential 또는:

```ts
const data = await post.getPost(decoded);
if (!data) notFound();
const { post: postData, content } = data;

const [viewCount, relatedPosts] = await Promise.all([
  visit.getVisitCount(postData.path),
  post.getRelatedPosts(postData, 4),
]);
```

이 패턴이 자연스러움.

### 4. PostCard 호환 확인

`<PostCard>` 의 props 가 `post: PostData` (또는 `Post`) 를 받는지 확인. 없으면 인접 변환 추가. grep:

```bash
grep -n "interface PostCardProps\|export function PostCard" src/components/PostCard.tsx
```

기존 `getRecentPosts` 결과로 호출되는 패턴과 동일하게 만든다.

### 5. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

grep -n "getRelatedPosts" src/infra/db/repositories/PostRepository.ts
test -f src/components/RelatedPosts.tsx
grep -n "RelatedPosts" src/app/posts/\[...slug\]/page.tsx
```

수동 smoke:
- 글 상세 페이지 진입 → ArticleFooter 다음 "이런 글도" 섹션 + 4 카드 표시
- 같은 tag 가진 다른 글이 있으면 그게 상위로
- tag 교집합 없을 때 같은 카테고리 최근 글이 fallback 으로 표시

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/infra/db/repositories/PostRepository.ts` | 수정 (getRelatedPosts + tagIntersectionSize helper) |
| `src/components/RelatedPosts.tsx` | 신규 |
| `src/app/posts/[...slug]/page.tsx` | 수정 (fetch + 컴포넌트 mount) |

## Out of Scope

- 임베딩 기반 의미 유사도 (별도 issue)
- 관련 글 클릭 추적 (analytics)
- 카테고리 외 다른 시리즈 우선 매칭 (시리즈 prev/next 는 plan033 에서 별도 처리)
- 캐싱 — 글 상세 페이지의 revalidate 정책 그대로

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| 같은 카테고리 글이 4개 미만이면 4 슬롯 못 채움 | 해당 케이스는 자연스럽게 1~3개 표시. 사용자 결정상 OK (`<RelatedPosts>` 가 0 일 때만 hide, 1+ 면 그대로 노출) |
| tagIntersectionSize 가 application-side 라 글 1000+ 시 느려짐 | 218 글 + 카테고리당 ~24 후보 + limit×4=16 candidate fetch — 부하 무시 가능. 1000+ 도달 시 SQL JSON_OVERLAPS / 인덱스 도입 |
| 한 글이 자기 자신과 매칭 (id 비교 누락) | `ne(posts.id, currentPost.id)` 명시 — 자기 자신 제외 |
| tag 가 빈 배열인 글이 다수면 점수 0 동점 | 동점은 createdAt desc 로 자연 정렬. stable sort 보장 |
