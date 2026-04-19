# Data Schema — 변경사항

**작성일:** 2026-04-19
**관련:** [prd.md](./prd.md) · [adr.md](./adr.md#adr-001)

---

## 1. 현재 스키마 (변경 없음)

`posts`, `visit_stats` 테이블 자체는 변경하지 않는다.

### posts (`src/infra/db/schema/posts.ts`)
- PK: `id (autoincrement)`
- Unique: `path`
- 기존 인덱스: `category_idx(category)`, `slug_idx(slug)`
- `updatedAt timestamp` (defaultNow, onUpdateNow)

### visit_stats (`src/infra/db/schema/visitStats.ts`)
- PK: `id (autoincrement)`
- 기존 인덱스: `visit_stats_page_path_idx(page_path, unique)`
- `visit_count int NOT NULL DEFAULT 0`

---

## 2. 추가 인덱스 (마이그레이션 필요)

### Index A: `posts` 최신 정렬 cursor 페이징 지원

```ts
// src/infra/db/schema/posts.ts
index("posts_updated_at_id_idx").on(
  sql`${table.updatedAt} DESC`,
  sql`${table.id} DESC`,
),
```

- **목적**: `WHERE is_active = 1 ORDER BY updated_at DESC, id DESC LIMIT 10` 및 cursor 조건 `(updated_at, id) < (?, ?)` 의 빠른 평가
- **없으면**: filesort 발생 → 200개 규모에서는 감내 가능하나 성장 시 degrade
- **주의**: drizzle-orm 0.45.1은 column-level `.desc()` index chain의 SQL 방향 직렬화가 불안정 → raw `sql\`${col} DESC\`` 템플릿 채택 (생성 SQL에 `DESC` 키워드 실측 확인)

### Index B: `visit_stats` 인기 정렬 offset 페이징 지원

```ts
// src/infra/db/schema/visitStats.ts
index("visit_stats_count_path_idx").on(
  sql`${table.visitCount} DESC`,
  sql`${table.pagePath} ASC`,
),
```

- **목적**: `ORDER BY visit_count DESC, page_path ASC LIMIT 10 OFFSET ?` 의 빠른 평가 + **동점일 때 순서 안정화** (ADR-002)
- **없으면**: visit_count 동점 시 페이지 간 중복/누락 가능

---

## 3. 마이그레이션 절차 (CLAUDE.md 규칙 준수)

```bash
# cwd: /Users/nhn/personal/fos-blog
# 1) 스키마 파일 수정 (위 두 인덱스 추가)
# 2) SQL 파일 생성 (절대 db:push 쓰지 말 것 — BLG1)
pnpm db:generate
# 3) git add drizzle/<new_sql_file> src/infra/db/schema/*.ts
# 4) 로컬 적용
pnpm db:migrate
```

**배포**: 홈서버에서 컨테이너 기동 시 자동 apply되지 않으므로 배포 런북에 `pnpm db:migrate` 실행 단계 포함되어야 함 (기존 관례 따름).

---

## 4. Repository 신규 메서드

### PostRepository

```ts
// Cursor 기반 최신글 (ADR-002)
async getRecentPostsCursor(params: {
  limit: number;                          // 10
  cursor?: { updatedAt: Date; id: number };  // 최초 호출은 undefined
}): Promise<PostData[]>
```

**SQL 의미**:
```sql
SELECT ... FROM posts
WHERE is_active = 1
  AND (cursor IS NULL
       OR (updated_at, id) < (:cursorUpdatedAt, :cursorId))
ORDER BY updated_at DESC, id DESC
LIMIT :limit
```

※ Drizzle에서 tuple 비교는 `sql` 템플릿으로 표현 — 구현은 `code-architecture.md` 참조.

### VisitRepository

```ts
// Offset 기반 인기글 경로 (ADR-002)
async getPopularPostPathsOffset(params: {
  limit: number;   // 10
  offset: number;  // 0, 10, 20, ...
}): Promise<Array<{ path: string; visitCount: number }>>

// 정렬 안정성 확보를 위한 total count
async getPopularPostPathsTotal(): Promise<number>
```

**SQL 의미**:
```sql
SELECT page_path, visit_count
FROM visit_stats
ORDER BY visit_count DESC, page_path ASC
LIMIT :limit OFFSET :offset
```

`hasMore` 계산은 API Route 레이어에서 `offset + popularPaths.length < total` 로 판정 (비활성 포스트로 `items`가 줄어도 `visit_stats` 기준으로 진행).

---

## 5. 반환 DTO

| 필드 | 출처 | 비고 |
|---|---|---|
| `title, path, slug, category, subcategory, folders, description` | `posts` | 기존 `PostData` 동일 |
| `visitCount` | `visit_stats.visit_count` (또는 0) | 두 페이지 모두 포함 |

---

## 6. 변경 제외

- `visitStats` 테이블에 아직 등록되지 않은 글은 인기 목록에 **나타나지 않음** — 의도적 동작 (PRD §7 인기글 AC 3)
- 신규 테이블 없음
- 컬럼 추가/삭제 없음
