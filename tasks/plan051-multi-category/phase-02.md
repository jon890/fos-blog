# Phase 02 — frontmatter categories 파싱 + sync 시 합집합 저장

**Model**: sonnet
**Status**: pending

---

## 목표

frontmatter 의 `categories: [..]` 를 파싱하고, sync 시 `posts.categories` 를
`[경로 category, ...frontmatter categories]` 합집합(중복 제거)으로 채운다 (ADR-030).
경로 첫 폴더 카테고리는 항상 포함되므로 frontmatter 가 없으면 `[category]` 1개가 된다.

**선행**: phase-01 (posts.categories 컬럼 + PostData.categories 타입).
**범위 외**: 조회(phase-03), UI(phase-04).

---

## 작업 항목 (4)

### 1. `src/lib/markdown.ts` — FrontMatter 타입에 categories 추가

`FrontMatter` 인터페이스에 `tags?: string[]` 과 같은 형태로 추가한다.

```ts
categories?: string[];
```

`parseFrontMatter` 가 YAML 배열을 이미 `tags` 로 처리하므로 별도 coercion 로직은 불필요하다. tags 가 어떻게 파싱되는지 같은 파일에서 확인하고 동일 경로를 탄다.

### 2. categories 합집합 계산 헬퍼

경로 category 와 frontmatter categories 를 합쳐 중복 제거하는 순수 함수를 만든다. 위치는 `parsePath` 가 있는 `src/services/PostSyncService.ts` 가 자연스럽다.

```ts
export function mergeCategories(pathCategory: string, fmCategories?: string[]): string[] {
  const all = [pathCategory, ...(fmCategories ?? [])]
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  return Array.from(new Set(all));   // 순서 보존 중복 제거 — pathCategory 가 항상 첫째(primary)
}
```

### 3. `src/services/SyncService.ts` — insert/update 에 categories 저장

현재 insert(추가)·update(업데이트) 두 분기에서 `category: file.category` 를 저장한다. 같은 두 지점에 `categories` 를 추가한다.

```ts
categories: mergeCategories(file.category, frontMatter.categories),
```

`frontMatter` 가 이미 파싱되어 있는 변수명을 해당 함수 스코프에서 확인해 사용한다(현재 series/tags 를 꺼내는 동일 객체). `mergeCategories` 를 import 한다.

### 4. `src/infra/db/repositories/PostRepository.ts` — select 에 categories 포함

`category: posts.category` 를 select 하는 메서드들에 `categories: posts.categories` 를 함께 select 한다. phase-03·phase-04 가 categories 를 읽으려면 조회 결과에 포함되어야 한다.

대상 메서드는 아래 grep 으로 특정한다.

```bash
# cwd: <repo root>
grep -n "category: posts.category" src/infra/db/repositories/PostRepository.ts
```

각 매치 라인 다음에 `categories: posts.categories,` 를 추가한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/lib/markdown.ts` | 수정 — FrontMatter.categories |
| `src/services/PostSyncService.ts` | 수정 — mergeCategories 헬퍼 export |
| `src/services/SyncService.ts` | 수정 — insert/update 에 categories 저장 |
| `src/infra/db/repositories/PostRepository.ts` | 수정 — select 에 categories 추가 |

## 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run

grep -n "categories" src/lib/markdown.ts                          # FrontMatter 타입
grep -n "export function mergeCategories" src/services/PostSyncService.ts
grep -c "categories: mergeCategories" src/services/SyncService.ts  # insert+update 2건 이상
grep -c "categories: posts.categories" src/infra/db/repositories/PostRepository.ts  # 1건 이상
```

`mergeCategories` 단위 테스트를 `src/services/PostSyncService.test.ts` 에 추가한다(기존 parsePath 테스트 옆).

- 경로만(frontmatter 없음) → `["AI"]`
- 경로 + frontmatter 중복 → 중복 제거, primary 첫째 유지 (예: `mergeCategories("AI", ["AI","DevOps"])` → `["AI","DevOps"]`)
- 빈 문자열·공백 입력 제거

## 의도 메모 (왜)

- 합집합에 pathCategory 를 항상 첫째로 넣어 primary 순서를 보장한다 — UI 에서 첫 배지를 primary 로 쓸 수 있다.
- `Set` 으로 순서 보존 중복 제거 — frontmatter 에 경로 카테고리를 중복 적어도 안전하다.
- select 누락은 phase-03/04 에서 categories 가 undefined 가 되는 런타임 결함으로 이어지므로 이 phase 에서 함께 처리한다.
