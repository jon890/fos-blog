# Phase 02 — frontmatter categories 저장 (full + incremental sync 정합)

**Model**: sonnet
**Status**: pending

---

## 목표

sync 시 `posts.categories` 를 합집합 `[경로 category, ...frontmatter categories]`(중복 제거)로 채운다 (ADR-030).
**핵심**: sync 경로가 둘(full / incremental)인데 incremental 경로(`PostSyncService.upsert`)는 현재 frontmatter 를 파싱하지 않아 tags/series 도 저장하지 않는다.
두 경로가 같은 공통 헬퍼로 frontmatter 를 처리하도록 정합시켜, 평상시(증분) 운영에서 categories 가 누락되지 않게 한다.

**선행**: phase-01 (posts.categories 컬럼 + PostData.categories + FrontMatter.categories 타입).
**범위 외**: 카테고리 페이지 노출(phase-03), 배지 UI(phase-04). select 추가는 노출 면을 다루는 phase 에서.

---

## 작업 항목 (5)

### 1. `mergeCategories` 순수 함수 (export, `src/services/PostSyncService.ts`)

경로 category 와 frontmatter categories 를 합쳐 순서 보존 중복 제거한다. `parsePath` 옆에 둔다.

```ts
export function mergeCategories(pathCategory: string, fmCategories?: string[]): string[] {
  const all = [pathCategory, ...(fmCategories ?? [])]
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  return Array.from(new Set(all));   // pathCategory 가 항상 첫째(primary)
}
```

### 2. `resolveFrontMatterMeta` 순수 함수 (export, `src/services/PostSyncService.ts`)

현재 `SyncService.performFullSync` 안에 인라인으로 있는 tags/series/seriesOrder 파싱 로직(현재 약 170~196번 줄: `normalizeTags` + series/seriesOrder 검증)을 그대로 옮겨 공통화한다.

```ts
export function resolveFrontMatterMeta(frontMatter: FrontMatter, path: string): {
  tags: string[];
  series: string | null;
  seriesOrder: number | null;
} { /* 기존 performFullSync 의 series/seriesOrder/tags 검증 로직을 동일하게 */ }
```

**`normalizeTags` 는 이동한다 (순환 import 금지)**: `normalizeTags` 는 현재 `src/services/SyncService.ts` 의 module-private 함수다(export 안 됨). 그리고 `SyncService.ts` 가 이미 `import { ... } from "./PostSyncService"` 로 SyncService → PostSyncService 단방향 의존을 가진다.
따라서 `normalizeTags` 를 `SyncService` 에서 export 해 `PostSyncService` 로 import 하면 **양방향 순환 import**가 된다(`import/no-cycle` lint 위반 + 구조 결함).

- `normalizeTags` 함수를 `SyncService.ts` → `PostSyncService.ts` 로 **이동**한다(`resolveFrontMatterMeta` 옆).
- `SyncService.ts` 는 더 이상 normalizeTags 를 직접 쓰지 않는다(아래 작업 3 에서 `resolveFrontMatterMeta` 호출로 대체). 만약 `SyncService` 가 normalizeTags 를 따로 더 써야 하면 `PostSyncService` 에서 import 한다(단방향 유지).
- **`normalizeTags` 를 `SyncService` 에서 export → `PostSyncService` 에서 import 하지 말 것**(역방향 순환).

**series/order 검증 경고 처리**: 원본 로직(SyncService.ts:191-194 부근)은 `log.warn({ path: file.path, ... })` 로 잘못된 seriesOrder 를 경고한다. 순수 함수로 옮기면 path·logger 맥락이 사라지므로 **path 인자를 받아 헬퍼 내부에서 경고**한다(위 시그니처의 `path` 인자). `PostSyncService` 의 기존 logger(`logger.child({ module: ... })`)를 grep 으로 확인해 동일 패턴으로 가져온다. **기존 동작(경고 발생 조건·메시지)을 바꾸지 않는다**(추출 + 정합만).

### 3. `SyncService.performFullSync` — 헬퍼 사용 + categories 저장

인라인 tags/series 파싱을 `resolveFrontMatterMeta(frontMatter, file.path)` 호출로 교체한다.
update·create 두 분기(현재 약 199·216번 줄)에 `categories` 를 추가한다.

```ts
categories: mergeCategories(file.category, frontMatter.categories),
```

`mergeCategories` / `resolveFrontMatterMeta` 를 import 한다. 기존 `category: file.category` 는 유지한다.

### 4. `PostSyncService.upsert` — frontmatter 파싱 + tags/series/categories 저장

현재 `upsert` 는 `parsePath` 만 쓰고 frontmatter 를 파싱하지 않는다. `content` 는 이미 만들어져 있다(`rewriteImagePaths` 결과).
`parseFrontMatter(content)` 로 frontMatter 를 얻어 `resolveFrontMatterMeta(frontMatter, path)` + `mergeCategories` 를 적용하고, update·create 두 분기에 `tags` / `series` / `seriesOrder` / `categories` 를 추가 저장한다(path 는 upsert 가 받는 파일 경로 인자를 그대로 전달).

이로써 증분 경로가 full 경로와 동일한 메타를 저장한다(기존 tags/series 누락도 함께 해소).

### 5. 단위 테스트 (`src/services/PostSyncService.test.ts`)

`mergeCategories` + `resolveFrontMatterMeta` 테스트를 기존 `parsePath` 테스트 옆에 추가한다.

- `mergeCategories("AI", undefined)` → `["AI"]`
- `mergeCategories("AI", ["AI", "DevOps"])` → `["AI", "DevOps"]` (중복 제거, primary 첫째)
- `mergeCategories("AI", [" ", "DevOps"])` → `["AI", "DevOps"]` (공백 제거)
- `resolveFrontMatterMeta` — series + 유효 seriesOrder / series 만 있고 order 누락 / tags 정규화 케이스

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/services/PostSyncService.ts` | 수정 — mergeCategories + resolveFrontMatterMeta export |
| `src/services/SyncService.ts` | 수정 — 헬퍼 사용 + performFullSync update/create 에 categories |
| `src/services/PostSyncService.test.ts` | 수정 — 헬퍼 단위 테스트 |

## 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run

grep -n "export function mergeCategories" src/services/PostSyncService.ts
grep -n "export function resolveFrontMatterMeta" src/services/PostSyncService.ts
grep -c "categories: mergeCategories" src/services/SyncService.ts   # performFullSync update+create 2건 이상
# 증분 경로가 frontmatter 를 파싱하는지 (upsert 가 parseFrontMatter 호출)
grep -n "parseFrontMatter" src/services/PostSyncService.ts          # 1건 이상
grep -c "categories: mergeCategories\|resolveFrontMatterMeta" src/services/PostSyncService.ts

# 순환 import 가드 — normalizeTags 이동 확인 + 역방향 import 없음
grep -n "function normalizeTags" src/services/PostSyncService.ts    # 이동 완료(정의 존재)
! grep -n 'from "./SyncService"' src/services/PostSyncService.ts    # PostSyncService → SyncService 역방향 import 없음 (exit 1 기대)
```

## 의도 메모 (왜)

- 공통 헬퍼로 추출하는 이유: full/incremental 두 경로가 frontmatter 처리를 따로 두면 또 drift 한다(이번 plan 의 categories 누락이 바로 그 drift). 공통 헬퍼가 정합을 강제한다.
- 합집합에 pathCategory 를 항상 첫째로 넣어 primary 순서를 보장한다 — UI 에서 첫 배지를 primary 로 쓴다.
- 증분 경로의 tags/series 복원은 categories 를 파싱하면서 자연히 따라오는 정합 수정이다(사용자 결정: frontmatter 전체 파싱으로 정합).
- frontmatter 카테고리명은 폴더명과 대소문자가 일치해야 phase-03 의 `JSON_CONTAINS` 가 매칭한다 — 정규화는 후속 plan(ADR-030 범위 제외).
