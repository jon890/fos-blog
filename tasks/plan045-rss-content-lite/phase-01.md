# Phase 01 — PostRepository / RSSService lite 메서드 신규 + route 호출 변경

**Model**: sonnet
**Status**: pending

---

## 목표

`/rss.xml` 캐시 미스 시 DB 트래픽 감소. `posts.content` (수십KB × 50개) 컬럼을 select 에서 제거한 lite path 신규.
기존 `getRecentActive` / `getRecentForFeed` 는 그대로 유지 (다른 호출자 보호).

**범위 외**: 회귀 테스트 (phase 02). thundering herd mutex (OOS — docs 에 명시). description 자동 백필 (별도 plan 후보).

---

## 작업 항목 (3)

### 1. `src/infra/db/repositories/PostRepository.ts` — `getRecentActiveLite` 신규 메서드

기존 `getRecentActive` (L63-94) 와 거의 동일하지만 `content` 컬럼 제거:

```ts
async getRecentActiveLite({ limit = 50 }: { limit?: number } = {}): Promise<
  Array<
    Pick<
      PostData,
      | "title"
      | "path"
      | "slug"
      | "category"
      | "subcategory"
      | "folders"
      | "description"
      | "createdAt"
    >
  >
> {
  return this.db
    .select({
      title: posts.title,
      path: posts.path,
      slug: posts.slug,
      category: posts.category,
      subcategory: posts.subcategory,
      folders: posts.folders,
      description: posts.description,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.isActive, true))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
}
```

핵심:
- 반환 타입에 `Pick<...>` 명시 — content 미포함 사실을 타입으로 노출. 호출자가 실수로 `p.content` 접근 시 컴파일 에러
- `getRecentActive` 그대로 유지 — 다른 호출자 (현재 없음) 보호. 향후 deprecated 명시 또는 제거는 별도 plan
- BLG15 (Drizzle .select 부분 필드 + 광범위 반환 타입 mismatch 금지) 준수 — select 객체와 Pick 키 집합 1:1 일치

### 2. `src/services/RSSService.ts` — `getRecentForFeedLite` + 타입 신규

새 타입 `RSSPostDataLite`:

```ts
export type RSSPostDataLite = Pick<
  PostData,
  | "title"
  | "path"
  | "slug"
  | "category"
  | "subcategory"
  | "folders"
  | "description"
  | "createdAt"
>;
```

새 메서드 — `RSSRepositories` 인터페이스에 추가:

```ts
interface RSSPostRepository {
  getRecentActive(args: { limit?: number }): Promise<RSSPostData[]>;
  getRecentActiveLite(args: { limit?: number }): Promise<RSSPostDataLite[]>;
}
```

createRSSService 안에 추가:

```ts
async getRecentForFeedLite({ limit = 50 }: { limit?: number } = {}): Promise<
  RSSPostDataLite[]
> {
  return repos.post.getRecentActiveLite({ limit });
},
```

기존 `RSSPostData` 와 `getRecentForFeed` 는 그대로 유지.

### 3. `src/app/rss.xml/route.ts` — lite 호출 + content fallback 제거

현재 (L21-25):
```ts
const rss = createDefaultRSSService();
const posts = await rss.getRecentForFeed({ limit: 50 });

const items = posts
  .map((p) => {
    // ...
    const desc = extractDescription(p.content ?? p.description ?? "", 300);
```

변경:
```ts
const rss = createDefaultRSSService();
const posts = await rss.getRecentForFeedLite({ limit: 50 });

const items = posts
  .map((p) => {
    // ...
    const desc = extractDescription(p.description ?? "", 300);
```

핵심:
- `getRecentForFeedLite` 호출
- `p.content ?? p.description ?? ""` → `p.description ?? ""` 로 단순화. content 컬럼 없으니 fallback 불요
- description null 인 글은 `extractDescription("", 300)` = 빈 string → RSS `<description></description>` 빈 desc 로 출력 (글은 RSS feed 에 그대로 포함, description 만 빔)

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/infra/db/repositories/PostRepository.ts` | `getRecentActiveLite` 신규 (기존 메서드 보존) |
| `src/services/RSSService.ts` | `RSSPostDataLite` 타입 + `getRecentForFeedLite` 메서드 + `RSSPostRepository` interface 보강 |
| `src/app/rss.xml/route.ts` | lite 호출 + content fallback 제거 |

## 검증

```bash
# cwd: <repo root>
# branch: feat/plan045-rss-content-lite-impl (build-with-teams 자동 생성)

pnpm lint
pnpm type-check

# 1. lite 메서드 추가
grep -nE "getRecentActiveLite" src/infra/db/repositories/PostRepository.ts | wc -l
# 기대: ≥ 1

grep -nE "getRecentForFeedLite" src/services/RSSService.ts | wc -l
# 기대: ≥ 2 (interface + 메서드 정의)

# 2. route 가 lite 사용 + content fallback 제거
grep -nE "getRecentForFeedLite" "src/app/rss.xml/route.ts" | wc -l
# 기대: 1

grep -nE "p\.content\s*\?\?\s*p\.description" "src/app/rss.xml/route.ts" | wc -l
# 기대: 0 (fallback 제거)

# 3. select 객체와 Pick 키 1:1 (BLG15)
# getRecentActiveLite 의 .select({...}) 키 8개와 Pick 8개 일치
# (수동 확인 — title/path/slug/category/subcategory/folders/description/createdAt)

# 4. 기존 메서드 보존
grep -nE "async getRecentActive\(\{" src/infra/db/repositories/PostRepository.ts | wc -l
# 기대: 1 (Lite 버전과 별도)

grep -nE "async getRecentForFeed\(\{" src/services/RSSService.ts | wc -l
# 기대: 1 (Lite 버전과 별도)
```

수동 smoke (`pnpm dev`):
- `curl -s http://localhost:3000/rss.xml | head -50` — RSS 정상 출력
- 50개 item 모두 description 채워짐 (또는 빈 desc 인 글이 있음). title / link / pubDate 정상
- DevTools Network 또는 server log — 캐시 미스 시 SQL 쿼리에서 `posts.content` 선택 없음 확인 (`pnpm db:studio` 의 query log 또는 drizzle debug)

## 의도 메모 (왜)

- **lite 메서드 신규 (기존 보존)**: 기존 `getRecentActive` / `getRecentForFeed` 의 다른 호출자가 없어도 신규 추가가 가장 안전. 보존 비용 ~30줄, 회귀 위험 0
- **`Pick<PostData, ...>` 명시 (BLG15)**: select 객체와 반환 타입의 키 집합을 컴파일러가 강제. content 컬럼 추가 시도 시 즉시 type 에러
- **description null fallback 제거**: lite path 의 의도가 content 회피인데 fallback 으로 content 다시 필요해지면 lite 가 무의미. description 없는 글은 description 없는 RSS item 으로 — RSS reader 가 title + link 만으로 표시 (정상 동작)
- **`getRecentActive` deprecation 안 함**: 별도 plan 에서 검토. 본 plan scope 는 RSS 한정
