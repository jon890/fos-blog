# Phase 02 — 동적 category 표시와 자동 등록

**Execution profile**: standard
**Status**: completed

---

## 목표

정적 category meta가 없는 새 최상위 폴더도 코드 수정 없이 고유 이름과 안정적인 시각 표현으로 노출한다.
기존 category의 별칭·색상·아이콘은 유지한다.

**범위 외**: 사용자 지정 category 설정 파일, 빈 폴더 category, DB schema, OG 이미지 팔레트 변경.

---

## 작업 항목 (4)

### 1. `src/lib/category-meta.ts` — 표시명과 색상 판정 분리

다음 표시 함수를 추가한다.

```ts
export function getCategoryLabel(raw: string): string
```

trim한 전체 key 또는 첫 path segment가 `RAW_TO_CANONICAL`에 있으면 기존 canonical label을 반환한다.
둘 다 없으면 trim한 원래 key를 반환하고, 빈 값만 `system`을 사용한다.

`getCategoryHue()`는 알려진 key의 기존 hue를 그대로 유지한다.
미등록 key는 첫 path segment의 안정적인 문자열 hash로 `0 <= hue < 360` 값을 계산한다.
같은 최상위 폴더의 slash path는 같은 hue를 사용하며 프로세스·호출 순서에 의존하지 않아야 한다.
`toCanonicalCategory()`와 `getCategoryTokenVar()`의 기존 공개 계약은 제거하지 않는다.

### 2. category label 소비자 전환

category 이름을 사용자에게 표시하는 다음 컴포넌트가 `toCanonicalCategory()` 대신 `getCategoryLabel()`을 사용하게 한다.

- `src/components/PostCard.tsx`
- `src/components/CategoryCard.tsx`
- `src/components/CategoryFeatured.tsx`
- `src/components/SeriesCard.tsx`
- `src/components/ArticleHero.tsx`

링크 slug, 저장 category key, CSS custom property에는 원본 key를 계속 사용한다.
스타일 계산은 기존 `getCategoryColor()`를 재사용한다.

### 3. 기본 아이콘과 category 자동 등록 보존

`getCategoryIcon()`이 정적 아이콘이 없는 key에 `DEFAULT_CATEGORY_ICON`인 `📁`을 반환하는 기존 동작을 유지한다.
`MetadataSyncService.updateCategories()`가 `PostRepository.getCategoryStats()`의 미등록 최상위 category도 `CategoryRepository.syncAll()`에 전달하는지 테스트로 고정한다.

새 category 설정 테이블이나 `.category.yml`을 추가하지 않는다.
활성 글이 하나 이상 있는 최상위 폴더만 기존 metadata 갱신 과정에서 category row를 생성한다.

### 4. 표시 회귀 테스트

`src/lib/category-meta.test.ts`에 다음 동작을 추가한다.

- 기존 `AI`, `database`, `javascript`의 label과 hue는 유지된다.
- `blockchain` label은 `system`이 아니라 `blockchain`이다.
- `blockchain`과 `blockchain/evm`은 같은 안정적 hue를 사용한다.
- 서로 다른 미등록 key의 hash 충돌 여부를 테스트 조건으로 삼지 않고 유효 범위와 반복 호출 안정성을 검증한다.
- 빈 key는 안전한 기존 대체값을 사용한다.

아이콘과 metadata 테스트에는 미등록 `blockchain`이 기본 아이콘과 category sync 입력으로 전달되는 사례를 추가한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/lib/category-meta.ts` | 동적 label과 hash hue |
| `src/lib/category-meta.test.ts` | 기존 meta와 동적 대체값 회귀 |
| `src/components/PostCard.tsx` | 동적 label 표시 |
| `src/components/CategoryCard.tsx` | 동적 label 표시 |
| `src/components/CategoryFeatured.tsx` | 동적 label 표시 |
| `src/components/SeriesCard.tsx` | 동적 label 표시 |
| `src/components/ArticleHero.tsx` | 글 상세 category chip의 동적 label 표시 |
| `src/infra/db/constants.test.ts` | 기본 아이콘 회귀 |
| `src/services/MetadataSyncService.test.ts` | 신규 category 자동 등록 회귀 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog/.claude/worktrees/plan055-github-folder-categories
# branch: feat/plan055-github-folder-categories
pnpm test src/lib/category-meta.test.ts src/infra/db/constants.test.ts src/services/MetadataSyncService.test.ts
pnpm type-check
! rg -n "toCanonicalCategory" src/components/PostCard.tsx src/components/CategoryCard.tsx src/components/CategoryFeatured.tsx src/components/SeriesCard.tsx src/components/ArticleHero.tsx
```

기대값:

- 테스트와 type-check exit code가 0이다.
- category 표시 컴포넌트에서 `toCanonicalCategory` 사용이 0건이다.
- 기존 정적 category의 기대 색상과 아이콘 테스트가 계속 통과한다.

## 의도 메모 (왜)

- category 존재 여부와 디자인 재정의 여부를 분리해야 새 콘텐츠 폴더가 애플리케이션 배포에 종속되지 않는다.
- 알려진 category의 기존 디자인을 보존해 화면 회귀를 피하고, 미등록 category만 결정적인 대체값을 사용한다.
- 사용자 지정 meta 파일은 schema·검증·동기화 책임을 추가하므로 이번 자동 등록 범위에 포함하지 않는다.
