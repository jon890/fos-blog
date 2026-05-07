# Phase 02 — getPostsByTag + /tag/[name] 페이지 + ArticleFooter tag link

**Model**: sonnet
**Goal**: tag 별 글 조회 메서드 + tag 상세 페이지 라우트 + ArticleFooter 의 tag chip 클릭 시 이동.

## Context (자기완결)

phase 1 에서 `posts.tags` JSON 컬럼 + sync 확장 완료. 이번 phase 는 사용자 흐름:
- 글 상세 페이지 `<ArticleFooter>` 의 `#javascript` 클릭 → `/tag/javascript` 이동
- `/tag/javascript` 페이지: 해당 tag 가진 모든 글 리스트 (sub-hero + PostCard grid)

## 작업 항목

### 1. `PostRepository.getPostsByTag(tag: string, opts?: { limit, offset })` 신규

`src/infra/db/repositories/PostRepository.ts` 에 추가:

```ts
async getPostsByTag(
  tag: string,
  { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<Post[]> {
  const normalized = tag.trim().toLowerCase();
  return this.db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.isActive, true),
        sql`JSON_CONTAINS(${posts.tags}, JSON_QUOTE(${normalized}))`,
      ),
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
}
```

**MySQL JSON_CONTAINS**: 두 번째 인자가 JSON 값이라 `JSON_QUOTE(?)` 로 string → `"value"` 변환. `?` 바인딩으로 SQL injection 안전.

count 메서드도 같은 패턴:
```ts
async countPostsByTag(tag: string): Promise<number> {
  const normalized = tag.trim().toLowerCase();
  const [{ count }] = await this.db
    .select({ count: sql<string>`count(*)` })
    .from(posts)
    .where(
      and(
        eq(posts.isActive, true),
        sql`JSON_CONTAINS(${posts.tags}, JSON_QUOTE(${normalized}))`,
      ),
    );
  return Number(count);
}
```

(MySQL count 은 `sql<string>` 으로 받고 외부에서 `Number()` — common-pitfalls 패턴)

### 2. `src/app/tag/[name]/page.tsx` 신규

```tsx
import { notFound } from "next/navigation";
import { getRepositories } from "@/infra/db/repositories";
import { PostsListSubHero } from "@/components/PostsListSubHero";
import { PostCard } from "@/components/PostCard";
import type { Metadata } from "next";
import { env } from "@/env";

export const revalidate = 300;  // 5분

interface Props {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const tag = decodeURIComponent(name);
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  return {
    title: `#${tag}`,
    description: `${tag} 태그가 달린 글 모음`,
    alternates: { canonical: `${siteUrl}/tag/${encodeURIComponent(tag)}` },
    robots: { index: true, follow: true },
  };
}

export default async function TagPage({ params }: Props) {
  const { name } = await params;
  const tag = decodeURIComponent(name);
  const { post } = getRepositories();
  const [posts, total] = await Promise.all([
    post.getPostsByTag(tag, { limit: 50 }),
    post.countPostsByTag(tag),
  ]);

  if (total === 0) notFound();

  return (
    <div className="container mx-auto max-w-[1180px] px-4">
      <PostsListSubHero
        eyebrow="TAG"
        title={`#${tag}`}
        meta={`${total} POSTS`}
      />
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-16">
        {posts.map((p) => (
          <li key={p.path}><PostCard post={p} /></li>
        ))}
      </ul>
    </div>
  );
}
```

`PostsListSubHero` props 에 `accent` 가 `"popular"` 만 정의됐다면 그대로 사용 (accent 없이). 또는 신규 accent variant 가 필요하면 phase 2 OOS — 단순히 기본 sub-hero 사용.

### 3. `src/components/ArticleFooter.tsx` tag link 활성화

기존 코드:
```tsx
{tags.map((tag) => (
  <span key={tag} ...>#{tag}</span>
))}
```

→ `<Link href="/tag/{encoded}">` 로 교체. 색상은 `text-[var(--color-fg-muted)] hover:text-[var(--color-brand-400)]` 패턴 (plan009 토큰).

```tsx
import Link from "next/link";

{tags.map((tag) => (
  <Link
    key={tag}
    href={`/tag/${encodeURIComponent(tag)}`}
    className="text-[var(--color-fg-muted)] hover:text-[var(--color-brand-400)] transition-colors"
  >
    #{tag}
  </Link>
))}
```

기존 컨테이너 / spacing className 은 그대로.

### 4. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

test -f src/app/tag/\[name\]/page.tsx
grep -n "getPostsByTag\|countPostsByTag" src/infra/db/repositories/PostRepository.ts
grep -n "/tag/" src/components/ArticleFooter.tsx
```

수동 smoke:
- 글 상세 페이지에서 `#javascript` 클릭 → `/tag/javascript` 이동
- 결과 페이지에 해당 tag 글 N개 표시
- 존재하지 않는 tag (`/tag/nonexistent`) → 404

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/infra/db/repositories/PostRepository.ts` | 수정 (getPostsByTag + countPostsByTag) |
| `src/app/tag/[name]/page.tsx` | 신규 |
| `src/components/ArticleFooter.tsx` | 수정 (tag → Link) |

## Out of Scope

- /tags 인덱스 페이지
- 무한 스크롤 / pagination (50 limit 으로 충분)
- 비활성 (isActive=false) 글 별도 처리 — 이미 where 절에 포함

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| JSON_CONTAINS 가 MySQL 인덱스 미사용 (full table scan) | 218 글 규모에서 무시 가능. 향후 성능 이슈 시 별도 tags 테이블 정규화 (issue #72 backup) |
| tag URL encoding 의 한글 처리 | Next.js dynamic route 가 URL decode 자동 — `decodeURIComponent(name)` 명시로 안전 |
| 빈 결과를 404 로 처리 시 SEO 영향 | 정상 동작 — 존재하지 않는 tag 는 색인 차단이 맞음. 정상 tag 는 글 수 = 1+ 라 항상 200 |
