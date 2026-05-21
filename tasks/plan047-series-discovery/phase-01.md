# Phase 01 — data layer: getAllSeries + SeriesInfo 타입

**Model**: sonnet
**Goal**: PostRepository 에 모든 시리즈를 list 하는 `getAllSeries(limit?)` 추가. N+1 회피 위해 2 쿼리로 구성. `SeriesInfo` 타입을 `src/infra/db/types.ts` 에 신설.

## Context (자기완결)

기존 PostRepository (`src/infra/db/repositories/PostRepository.ts`) 는 시리즈 관련 메서드 3개 보유:

- `getPostsBySeries(name)` — 특정 시리즈 글 목록
- `getSeriesNeighbors(post)` — 인접 글 (prev/next/total)
- `countSeries()` — distinct count

전체 시리즈를 list 하는 메서드는 없음. plan047 의 `/series` 인덱스 + 메인 페이지 시리즈 섹션에 필요.

**플젝 컨벤션 (CLAUDE.md)**:
- Drizzle ORM, MySQL 8.4
- 레이어: app → services → infra. 직접 schema 접근은 repository 안에서만
- 테스트: `*.test.ts` co-located, Vitest, `vi.mock()`

## 작업 항목

### 1. `SeriesInfo` 타입 추가

`src/infra/db/types.ts` 에 추가:

```ts
export interface SeriesInfo {
  name: string;
  postCount: number;
  latestUpdatedAt: Date;
  firstPost: {
    title: string;
    description: string | null;
    category: string;
    slug: string;
    path: string;
  };
}
```

위치: 기존 `PostData` 인터페이스 아래.

### 2. `PostRepository.getAllSeries(limit?)` 메서드 추가

위치: `countSeries()` 메서드 위 (`async countSeries()` 직전).

```ts
async getAllSeries(limit?: number): Promise<SeriesInfo[]> {
  // 1. 시리즈별 aggregate — postCount, latestUpdatedAt, minSeriesOrder 수집
  let aggregateQuery = this.db
    .select({
      series: posts.series,
      postCount: sql<string>`count(*)`,
      latestUpdatedAt: sql<Date>`max(${posts.updatedAt})`,
      minSeriesOrder: sql<number>`min(${posts.seriesOrder})`,
    })
    .from(posts)
    .where(and(eq(posts.isActive, true), isNotNull(posts.series)))
    .groupBy(posts.series)
    .orderBy(sql`max(${posts.updatedAt}) desc`);

  if (typeof limit === "number") {
    aggregateQuery = aggregateQuery.limit(limit);
  }

  const aggregates = await aggregateQuery;
  if (aggregates.length === 0) return [];

  // 2. 각 시리즈의 첫 글 (seriesOrder = minSeriesOrder) fetch
  // MySQL 8 row constructor IN — (series, series_order) IN ((s1, o1), ...)
  const tuples = aggregates.map(
    (a) => sql`(${a.series}, ${a.minSeriesOrder})`,
  );

  const firstPosts = await this.db
    .select({
      title: posts.title,
      description: posts.description,
      category: posts.category,
      slug: posts.slug,
      path: posts.path,
      series: posts.series,
      seriesOrder: posts.seriesOrder,
    })
    .from(posts)
    .where(
      and(
        eq(posts.isActive, true),
        sql`(${posts.series}, ${posts.seriesOrder}) IN (${sql.join(tuples, sql`, `)})`,
      ),
    );

  const firstPostByName = new Map(firstPosts.map((p) => [p.series!, p]));

  // 3. 조합. aggregate 정렬 (latestUpdatedAt DESC) 유지
  return aggregates.flatMap((a) => {
    const first = firstPostByName.get(a.series!);
    if (!first) return [];
    return [
      {
        name: a.series!,
        postCount: Number(a.postCount),
        latestUpdatedAt: a.latestUpdatedAt,
        firstPost: {
          title: first.title,
          description: first.description,
          category: first.category,
          slug: first.slug,
          path: first.path,
        },
      },
    ];
  });
}
```

import 추가 (파일 상단 기존 drizzle import 확장):

```ts
import { and, eq, isNotNull, sql, /* 기존 import */ } from "drizzle-orm";
```

기존 import 에 `isNotNull` 이 이미 있는지 확인 — `countSeries` 가 이미 사용 중이라 있을 가능성 큼. 없으면 추가.

### 3. 단위 테스트 추가

`src/infra/db/repositories/PostRepository.test.ts` 가 있으면 추가, 없으면 신설.

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PostRepository } from "./PostRepository";
// 기존 테스트의 setup/teardown 패턴 따름

describe("PostRepository.getAllSeries", () => {
  let repo: PostRepository;

  beforeEach(async () => {
    // 기존 패턴 따라 testDb 초기화
    // 테스트 데이터: 시리즈 A (글 3개), 시리즈 B (글 2개), 시리즈 없는 글 1개
  });

  afterEach(async () => {
    // 기존 패턴 따라 cleanup
  });

  it("시리즈가 없으면 빈 배열 반환", async () => {
    // 시리즈 없는 글만 있는 상태
    const result = await repo.getAllSeries();
    expect(result).toEqual([]);
  });

  it("시리즈별 postCount + latestUpdatedAt + firstPost 반환", async () => {
    const result = await repo.getAllSeries();
    expect(result).toHaveLength(2);
    const seriesA = result.find((s) => s.name === "A");
    expect(seriesA?.postCount).toBe(3);
    expect(seriesA?.firstPost.path).toBeDefined();
  });

  it("latestUpdatedAt DESC 정렬", async () => {
    // 시리즈 B 글에 더 최근 updatedAt
    const result = await repo.getAllSeries();
    expect(result[0].name).toBe("B");
    expect(result[1].name).toBe("A");
  });

  it("limit 지정 시 그만큼만 반환", async () => {
    const result = await repo.getAllSeries(1);
    expect(result).toHaveLength(1);
  });
});
```

기존 PostRepository.test.ts 의 setup/teardown 패턴 (`grep -n "describe\|beforeEach\|afterEach" src/infra/db/repositories/PostRepository.test.ts`) 으로 매칭.

테스트 파일이 없으면 plan047 단독으로 시작하지 말고 phase-04 의 통합 verification 으로 충분 — phase-01 의 테스트는 best-effort.

### 4. 자동 verification

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm lint
pnpm type-check
pnpm test --run -- PostRepository

# 메서드 존재 확인
grep -n "async getAllSeries" src/infra/db/repositories/PostRepository.ts

# 타입 존재 확인
grep -n "interface SeriesInfo" src/infra/db/types.ts
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/infra/db/types.ts` | 수정 (SeriesInfo 추가) |
| `src/infra/db/repositories/PostRepository.ts` | 수정 (getAllSeries 신설) |
| `src/infra/db/repositories/PostRepository.test.ts` | 수정 또는 신설 (best-effort) |

## Out of Scope

- UI / page 컴포넌트 → phase 02
- Header / 메인 페이지 진입점 → phase 03
- 통합 검증 / index.json 마킹 → phase 04

## Risks

| 리스크 | 완화 |
|---|---|
| MySQL row constructor IN 문법 호환성 | MySQL 5.7+ 지원. 본 프로젝트 8.4 → 문제 없음. 단 drizzle sql tag 로 직접 작성 — drizzle 의 자동 placeholder 가 row constructor 를 올바로 직렬화하는지 type-check 단계에서 검증 |
| seriesOrder NULL 인 row 가 minSeriesOrder 에 섞임 | aggregate 단계의 `isNotNull(posts.series)` 가 series 자체를 필터. seriesOrder NULL 인 시리즈 글은 sync 시점에 series 도 null 로 떨어짐 (SyncService 정책, plan033). 따라서 안전 |
| 시리즈명 NULL 으로 들어와 Map key 가 깨짐 | aggregate WHERE 절에 `isNotNull(posts.series)` 명시 — a.series 는 항상 non-null |
